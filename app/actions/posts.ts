"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import type { Prisma, User } from "@/app/generated/prisma/client";
import { PostLevel, PostStatus, ScopeType } from "@/app/generated/prisma/enums";
import { userActor, withAudit } from "@/lib/audit";
import { revalidatePositions } from "@/lib/auth/positions";
import {
  excerptFrom,
  guessMimeType,
  plainTextFromDocument,
  readingMinutes,
} from "@/lib/content/document";
import { decideReach, reachContextFor } from "@/lib/content/level";
import {
  auditActionFor,
  decidePublishStatus,
  materializeInlineImages,
  quotaRoleFor,
} from "@/lib/content/publish";
import { uniqueSlug } from "@/lib/content/slug";
import { resolveValidTopicIds } from "@/lib/content/topics";
import { db, serializableTransaction } from "@/lib/db";
import { mcAncestorOf } from "@/lib/org/entities";
import {
  availableAudiencesFor,
  resolveAudienceSize,
  resolveSubmittedAudience,
} from "@/lib/org/scope";
import {
  type PromotionPool,
  promotionPoolFor,
  promotionsUsedInPeriod,
  type ResolvedQuota,
  resolveQuotaPolicy,
} from "@/lib/quota";
import { checkRateLimit, retryMessage } from "@/lib/rate-limit";
import { can } from "@/lib/rbac/can";
import { NARROWEST_PUBLISHING_TIER } from "@/lib/rbac/catalogue";
import { checkPermission, requireSession } from "@/lib/rbac/guards";
import { currentTermLabel } from "@/lib/term";
import {
  type CreatePostInput,
  createPostSchema,
  fieldErrors,
  promotePostSchema,
  rejectPostSchema,
} from "@/lib/zod-schemas";

export type CreatePostResult =
  | { ok: true; postId: string; slug: string; status: "PUBLISHED" | "IN_REVIEW" | "SCHEDULED" }
  | { ok: false; errors: Record<string, string> };

export async function createPost(input: CreatePostInput): Promise<CreatePostResult> {
  const user = await requireSession();

  const entityId = user.primaryEntityId;
  if (!entityId) {
    return {
      ok: false,
      errors: { _form: "Your AIESEC entity is not on record yet. Sign out and back in." },
    };
  }

  const authorised = await checkPermission("post.publish", { type: "ENTITY", entityId });
  if (!authorised.ok) return { ok: false, errors: { _form: authorised.error } };

  const limit = await checkRateLimit("postSubmit", user.id);
  if (!limit.allowed) return { ok: false, errors: { _form: retryMessage(limit) } };

  // A posting restriction outranks the permission.
  const restricted = await db.userRestriction.findFirst({
    where: {
      userId: user.id,
      kind: "posting",
      startsAt: { lte: new Date() },
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    select: { reason: true },
  });
  if (restricted) {
    return {
      ok: false,
      errors: { _form: `Posting is currently restricted: ${restricted.reason}` },
    };
  }

  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const {
    title,
    titleAccent,
    bodyJson,
    summary,
    linkUrl,
    mediaUrl,
    mediaAlt,
    scheduledAt,
    audience,
    topicIds,
    promoteToNetwork,
    promotionNote,
  } = parsed.data;
  const bodyText = plainTextFromDocument(bodyJson);

  const roleKey = (await quotaRoleFor(user, entityId)) ?? NARROWEST_PUBLISHING_TIER;
  const policy = await resolveQuotaPolicy(entityId, roleKey, PostLevel.LOCAL);
  if (!policy) {
    return { ok: false, errors: { _form: "No publishing quota is configured for your role." } };
  }

  const audienceOptions = await availableAudiencesFor(user, entityId);
  const audienceDecision = await resolveSubmittedAudience(audienceOptions, audience);
  if (!audienceDecision.ok) {
    return { ok: false, errors: { audience: audienceDecision.error } };
  }
  const audiences = audienceDecision.audiences;
  const validTopicIds = await resolveValidTopicIds(topicIds ?? []);

  // Resolved after audience: a narrowed audience overrides an AI-level
  // office's network default. Kept outside the tx — only the budget count
  // needs serializability.
  const reach = await reachContextFor(
    user,
    entityId,
    roleKey,
    audiences.some((a) => a.scopeType === ScopeType.GLOBAL)
  );

  const slug = await uniqueSlug(title);
  const audienceSize = await resolveAudienceSize(audiences);

  let coverMediaId: string | null = null;
  if (mediaUrl) {
    const media = await db.media.create({
      data: {
        ownerId: user.id,
        bucket: "post-media",
        path: mediaUrl.replace(/^.*\/post-media\//, ""),
        mimeType: guessMimeType(mediaUrl),
        bytes: 0,
        altText: mediaAlt ?? null,
      },
      select: { id: true },
    });
    coverMediaId = media.id;
  }

  const materializedBodyJson = await materializeInlineImages(bodyJson, user.id);

  const outcome = await serializableTransaction(async (tx) => {
    const status = await decidePublishStatus(tx, user.id, policy, scheduledAt);

    const decision = await decideReach(tx, reach, user.id, status, {
      promoteToNetwork: promoteToNetwork ?? false,
      note: promotionNote,
    });
    // Return before writing — an empty commit, not an unwanted local post.
    if (!decision.ok) return { refused: decision, post: null, status, decision: null };

    const post = await tx.post.create({
      data: {
        slug,
        authorId: user.id,
        publisherEntityId: entityId,
        termLabel: currentTermLabel(),
        level: decision.level,
        ...(decision.stamp ?? {}),
        title,
        // Sent in full, not merged — clearing the highlight must stay
        // expressible, and `undefined` in Prisma `data` means "leave alone".
        titleAccent: titleAccent || null,
        summary: summary?.trim() || excerptFrom(bodyText),
        bodyJson: materializedBodyJson as unknown as Prisma.InputJsonValue,
        bodyText,
        readingMinutes: readingMinutes(bodyText),
        coverMediaId,
        linkUrl: linkUrl || null,
        status,
        scheduledAt: status === PostStatus.SCHEDULED ? scheduledAt : null,
        quotaPeriod: policy.periodLabel,
        publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
        audienceSize,
        audiences: { create: audiences },
        topics: { create: validTopicIds.map((topicId) => ({ topicId })) },
        versions: {
          create: {
            version: 1,
            title,
            summary: summary?.trim() || excerptFrom(bodyText),
            bodyJson: materializedBodyJson as unknown as Prisma.InputJsonValue,
            editedById: user.id,
          },
        },
        ...(coverMediaId ? { media: { create: { mediaId: coverMediaId, position: 0 } } } : {}),
      },
      select: { id: true, slug: true },
    });

    return { refused: null, post, status, decision };
  });

  if (outcome.refused) {
    return { ok: false, errors: { [outcome.refused.field]: outcome.refused.error } };
  }
  const { post, status, decision } = outcome;

  await withAudit(
    userActor(user),
    auditActionFor(status),
    { type: "post", id: post.id, entityId },
    {
      title,
      level: decision.level,
      quotaPeriod: policy.periodLabel,
      quotaMax: policy.maxPosts,
      ...(status === PostStatus.SCHEDULED ? { scheduledAt: scheduledAt!.toISOString() } : {}),
    },
    async () => undefined
  );

  // Audited under the same "post.promote" action as a later promotePost —
  // an auditor searching that action shouldn't miss promotions spent at publish.
  if (decision.stamp) {
    await withAudit(
      userActor(user),
      "post.promote",
      { type: "post", id: post.id, entityId },
      {
        title,
        note: decision.stamp.promotionNote,
        from: PostLevel.LOCAL,
        at: "publication",
        quotaPeriod: decision.stamp.promotionPeriod,
      },
      async () => undefined
    );
  }

  revalidateTag("feed", "max");
  revalidatePath("/feed");
  revalidatePath("/profile");
  if (status === PostStatus.IN_REVIEW) revalidatePath("/review");

  return { ok: true, postId: post.id, slug: post.slug, status };
}

export type ResubmitPostResult =
  | { ok: true; status: "PUBLISHED" | "IN_REVIEW" }
  | { ok: false; errors: Record<string, string> };

/** Re-enters the quota check rather than bypassing it. */
export async function resubmitPost(
  postId: string,
  input: CreatePostInput
): Promise<ResubmitPostResult> {
  const user = await requireSession();

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { authorId: true, status: true, publisherEntityId: true, title: true },
  });
  if (!post || post.authorId !== user.id) {
    return { ok: false, errors: { _form: "Post not found." } };
  }
  if (post.status !== PostStatus.REJECTED) {
    return { ok: false, errors: { _form: "Only rejected posts can be resubmitted." } };
  }

  const authorised = await checkPermission("post.publish", {
    type: "ENTITY",
    entityId: post.publisherEntityId,
  });
  if (!authorised.ok) return { ok: false, errors: { _form: authorised.error } };

  const limit = await checkRateLimit("postSubmit", user.id);
  if (!limit.allowed) return { ok: false, errors: { _form: retryMessage(limit) } };

  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const { title, titleAccent, bodyJson, summary, linkUrl, topicIds } = parsed.data;
  const bodyText = plainTextFromDocument(bodyJson);
  const roleKey = (await quotaRoleFor(user, post.publisherEntityId)) ?? NARROWEST_PUBLISHING_TIER;
  const policy = await resolveQuotaPolicy(post.publisherEntityId, roleKey, PostLevel.LOCAL);
  if (!policy)
    return { ok: false, errors: { _form: "No publishing quota is configured for your role." } };

  const materializedBodyJson = await materializeInlineImages(bodyJson, user.id);
  const validTopicIds = await resolveValidTopicIds(topicIds ?? []);

  const { status } = await serializableTransaction(async (tx) => {
    const status = await decidePublishStatus(tx, user.id, policy);

    const latest = await tx.postVersion.findFirst({
      where: { postId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    await tx.post.update({
      where: { id: postId },
      data: {
        title,
        titleAccent: titleAccent || null,
        summary: summary?.trim() || excerptFrom(bodyText),
        bodyJson: materializedBodyJson as unknown as Prisma.InputJsonValue,
        bodyText,
        readingMinutes: readingMinutes(bodyText),
        linkUrl: linkUrl || null,
        status,
        rejectionReason: null,
        quotaPeriod: policy.periodLabel,
        publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
        // Re-sent in full each time, same as createPost/publishDraft — not
        // merged with whatever the post already carried.
        topics: {
          deleteMany: {},
          create: validTopicIds.map((topicId) => ({ topicId })),
        },
        versions: {
          create: {
            version: (latest?.version ?? 0) + 1,
            title,
            summary: summary?.trim() || excerptFrom(bodyText),
            bodyJson: materializedBodyJson as unknown as Prisma.InputJsonValue,
            editedById: user.id,
            changeNote: "Resubmitted after rejection",
          },
        },
      },
    });

    return { status };
  });

  if (status === PostStatus.SCHEDULED) {
    // Guards against a silent SCHEDULED write with no scheduledAt: resubmission
    // never passes one, so decidePublishStatus should never return it here.
    throw new Error("Unexpected SCHEDULED status while resubmitting a post");
  }

  await withAudit(
    userActor(user),
    "post.resubmitted",
    { type: "post", id: postId, entityId: post.publisherEntityId },
    { status },
    async () => undefined
  );

  revalidateTag("feed", "max");
  revalidatePath("/profile");
  revalidatePath("/feed");
  if (status === PostStatus.IN_REVIEW) revalidatePath("/review");

  return { ok: true, status };
}

export async function approvePost(
  postId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { publisherEntityId: true, title: true, status: true },
  });
  if (!post) return { ok: false, error: "Post not found." };

  const authorised = await checkPermission("post.approve", {
    type: "ENTITY",
    entityId: post.publisherEntityId,
  });
  if (!authorised.ok) return { ok: false, error: authorised.error };

  if (post.status !== PostStatus.IN_REVIEW) {
    return { ok: false, error: "Only queued posts can be approved." };
  }

  return withAudit(
    userActor(authorised.user),
    "post.approved",
    { type: "post", id: postId, entityId: post.publisherEntityId },
    { title: post.title },
    async () => {
      await db.post.update({
        where: { id: postId },
        data: { status: PostStatus.PUBLISHED, publishedAt: new Date() },
      });
      revalidateTag("feed", "max");
      revalidatePath("/review");
      revalidatePath("/feed");
      return { ok: true as const };
    }
  );
}

export async function rejectPost(
  postId: string,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { publisherEntityId: true, title: true },
  });
  if (!post) return { ok: false, error: "Post not found." };

  const authorised = await checkPermission("post.approve", {
    type: "ENTITY",
    entityId: post.publisherEntityId,
  });
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const parsed = rejectPostSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: "Reason must be 5–500 characters." };

  return withAudit(
    userActor(authorised.user),
    "post.rejected",
    { type: "post", id: postId, entityId: post.publisherEntityId },
    { reason: parsed.data.reason, title: post.title },
    async () => {
      await db.post.update({
        where: { id: postId },
        data: { status: PostStatus.REJECTED, rejectionReason: parsed.data.reason },
      });
      revalidateTag("feed", "max");
      revalidatePath("/review");
      revalidatePath("/feed");
      return { ok: true as const };
    }
  );
}

/** Reversible: a deleted post cannot be restored when an appeal is upheld. */
export async function hidePost(
  postId: string,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { publisherEntityId: true, title: true },
  });
  if (!post) return { ok: false, error: "Post not found." };

  const authorised = await checkPermission("moderation.hide", {
    type: "ENTITY",
    entityId: post.publisherEntityId,
  });
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const parsed = rejectPostSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: "Reason must be 5–500 characters." };

  return withAudit(
    userActor(authorised.user),
    "post.hidden",
    { type: "post", id: postId, entityId: post.publisherEntityId },
    { reason: parsed.data.reason, title: post.title },
    async () => {
      await db.post.update({
        where: { id: postId },
        data: { status: PostStatus.HIDDEN, hiddenAt: new Date(), hiddenReason: parsed.data.reason },
      });
      revalidateTag("feed", "max");
      revalidatePath("/feed");
      revalidatePath("/moderation/posts");
      return { ok: true as const };
    }
  );
}

export async function restorePost(
  postId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { publisherEntityId: true, title: true, publishedAt: true },
  });
  if (!post) return { ok: false, error: "Post not found." };

  const authorised = await checkPermission("moderation.restore", {
    type: "ENTITY",
    entityId: post.publisherEntityId,
  });
  if (!authorised.ok) return { ok: false, error: authorised.error };

  return withAudit(
    userActor(authorised.user),
    "post.restored",
    { type: "post", id: postId, entityId: post.publisherEntityId },
    { title: post.title },
    async () => {
      await db.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.PUBLISHED,
          hiddenAt: null,
          hiddenReason: null,
          publishedAt: post.publishedAt ?? new Date(),
        },
      });
      revalidateTag("feed", "max");
      revalidatePath("/feed");
      revalidatePath("/moderation/posts");
      return { ok: true as const };
    }
  );
}

export type PromotionResult = { ok: true } | { ok: false; error: string };

export type PromotionBudget = {
  /** What the pool has spent this window, this post included. The label's number. */
  used: number;
  max: number;
  periodLabel: string;
  /**
   * Not just "budget left": a post already paid for this window can be
   * re-promoted after a demotion for free, so this can be true even when
   * the pool reads fully spent.
   */
  available: boolean;
};

type PromotionContext =
  | { ok: true; user: User; post: PromotablePost; pool: PromotionPool; policy: ResolvedQuota }
  | { ok: false; error: string };

type PromotablePost = {
  id: string;
  slug: string;
  title: string;
  level: PostLevel;
  status: PostStatus;
  publisherEntityId: string;
};

const promotableSelect = {
  id: true,
  slug: true,
  title: true,
  level: true,
  status: true,
  publisherEntityId: true,
} as const;

/**
 * Shared by promotePost, demotePost, and the budget label so the actor/MC/
 * budget checks can't drift — a demotion skipping the same-MC check would
 * let someone withdraw another MC's post.
 *
 * GIS position revalidation is the callers' job: the two writes do it, the
 * budget read doesn't.
 */
async function promotionContextFor(
  postId: string,
  permission: "post.promote" | "post.demote"
): Promise<PromotionContext> {
  const post = await db.post.findUnique({ where: { id: postId }, select: promotableSelect });
  if (!post) return { ok: false, error: "Post not found." };

  const authorised = await checkPermission(permission, {
    type: "ENTITY",
    entityId: post.publisherEntityId,
  });
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const session = authorised.user;
  const [actorMc, postMc] = await Promise.all([
    session.primaryEntityId ? mcAncestorOf(session.primaryEntityId) : Promise.resolve(null),
    mcAncestorOf(post.publisherEntityId),
  ]);

  // The same-MC rule only applies to officers with an MC — an AI-level actor
  // has none, and their boundary is already the grant scope from the
  // permission check above (global, by design).
  if (actorMc && actorMc.id !== postMc?.id) {
    return { ok: false, error: "You can only promote posts from your own MC." };
  }

  const roleKey = await quotaRoleFor(session, post.publisherEntityId, permission);
  const policy = roleKey
    ? await resolveQuotaPolicy(actorMc?.id ?? null, roleKey, PostLevel.NETWORK)
    : null;
  if (!policy) {
    return { ok: false, error: "No promotion quota is configured for your position." };
  }

  return { ok: true, user: session, post, pool: promotionPoolFor(session.id, actorMc), policy };
}

/**
 * Null hides the control (viewer lacks promotion authority over the post).
 *
 * Skips GIS revalidation deliberately — this runs on every post-page render;
 * a stale "available" label is harmless since the actual write still
 * revalidates and refuses if needed.
 */
export async function promotionBudgetFor(postId: string): Promise<PromotionBudget | null> {
  const user = await requireSession();

  // GLOBAL here just asks "can they promote anywhere," answered from the
  // cached grants — lets a non-promoter bail before touching Post at all.
  if (!(await can(user, "post.promote"))) return null;

  const context = await promotionContextFor(postId, "post.promote");
  if (!context.ok) return null;

  const { pool, policy } = context;
  const [used, spentElsewhere] = await Promise.all([
    promotionsUsedInPeriod(db, pool, policy.periodLabel),
    promotionsUsedInPeriod(db, pool, policy.periodLabel, postId),
  ]);

  return {
    used,
    max: policy.maxPosts,
    periodLabel: policy.periodLabel,
    available: spentElsewhere < policy.maxPosts,
  };
}

export async function promotePost(postId: string, note: string): Promise<PromotionResult> {
  const user = await requireSession();

  const limit = await checkRateLimit("promote", user.id);
  if (!limit.allowed) return { ok: false, error: retryMessage(limit) };

  const parsed = promotePostSchema.safeParse({ note });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Give a reason." };
  }

  // Must run before the permission check (lib/auth/positions.ts): it expires
  // grants GIS no longer returns and busts can()'s per-request cache.
  const confirmed = await revalidatePositions(user);
  if (!confirmed.ok) return { ok: false, error: confirmed.error };

  const context = await promotionContextFor(postId, "post.promote");
  if (!context.ok) return context;

  const { post, pool, policy } = context;
  if (post.status !== PostStatus.PUBLISHED) {
    return { ok: false, error: "Only a published post can be promoted." };
  }
  if (post.level === PostLevel.NETWORK) {
    return { ok: false, error: "This post already reaches the whole network." };
  }

  // Serializable, so two officers of the same MC clicking at once cannot both
  // read the same "one left" and both spend it.
  const outcome = await serializableTransaction(async (tx) => {
    const used = await promotionsUsedInPeriod(tx, pool, policy.periodLabel, post.id);
    if (used >= policy.maxPosts) return { spent: false as const, used };

    await tx.post.update({
      where: { id: post.id },
      data: {
        level: PostLevel.NETWORK,
        promotedAt: new Date(),
        promotedById: context.user.id,
        promotionNote: parsed.data.note,
        promotionPeriod: policy.periodLabel,
      },
    });
    return { spent: true as const, used };
  });

  if (!outcome.spent) {
    return {
      ok: false,
      error: `Your MC has used all ${policy.maxPosts} promotions for ${policy.periodLabel}.`,
    };
  }

  await withAudit(
    userActor(context.user),
    "post.promote",
    { type: "post", id: post.id, entityId: post.publisherEntityId },
    {
      title: post.title,
      note: parsed.data.note,
      from: PostLevel.LOCAL,
      quotaPeriod: policy.periodLabel,
      quotaMax: policy.maxPosts,
    },
    async () => undefined
  );

  revalidatePromotedPost(post.slug);
  return { ok: true };
}

/**
 * Inverse of promotePost, but refunds nothing — `promotionPeriod` stays set
 * so the spend sticks. Otherwise promote/demote cycling would be an
 * unbounded reach budget.
 */
export async function demotePost(postId: string): Promise<PromotionResult> {
  const user = await requireSession();

  const limit = await checkRateLimit("promote", user.id);
  if (!limit.allowed) return { ok: false, error: retryMessage(limit) };

  // Same ordering as promotePost — before the permission check, never after
  // (see lib/auth/positions.ts).
  const confirmed = await revalidatePositions(user);
  if (!confirmed.ok) return { ok: false, error: confirmed.error };

  const context = await promotionContextFor(postId, "post.demote");
  if (!context.ok) return context;

  const { post } = context;
  if (post.level !== PostLevel.NETWORK) {
    return { ok: false, error: "This post is already local to your MC." };
  }

  return withAudit(
    userActor(context.user),
    "post.demote",
    { type: "post", id: post.id, entityId: post.publisherEntityId },
    { title: post.title, from: PostLevel.NETWORK },
    async () => {
      // Only `level` moves — promotedAt/promotedById/promotionNote/
      // promotionPeriod stay; the spend must remain permanent (see doc above).
      await db.post.update({ where: { id: post.id }, data: { level: PostLevel.LOCAL } });
      revalidatePromotedPost(post.slug);
      return { ok: true as const };
    }
  );
}

// A level change moves the post into or out of every other MC's feed, so the
// shared feed cache goes with it — not only this post's own page.
function revalidatePromotedPost(slug: string): void {
  revalidateTag("feed", "max");
  revalidatePath("/feed");
  revalidatePath(`/posts/${slug}`);
}
