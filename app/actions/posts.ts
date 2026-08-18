"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus } from "@/app/generated/prisma/enums";
import { userActor, withAudit } from "@/lib/audit";
import {
  excerptFrom,
  guessMimeType,
  plainTextFromDocument,
  readingMinutes,
} from "@/lib/content/document";
import {
  auditActionFor,
  decidePublishStatus,
  materializeInlineImages,
  publishingRoleFor,
} from "@/lib/content/publish";
import { uniqueSlug } from "@/lib/content/slug";
import { db, serializableTransaction } from "@/lib/db";
import {
  availableAudiencesFor,
  resolveAudienceSize,
  resolveSubmittedAudience,
} from "@/lib/org/scope";
import { resolveQuotaPolicy } from "@/lib/quota";
import { checkRateLimit, retryMessage } from "@/lib/rate-limit";
import { checkPermission, requireSession } from "@/lib/rbac/guards";
import { currentTermLabel } from "@/lib/term";
import {
  type CreatePostInput,
  createPostSchema,
  fieldErrors,
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

  const { title, bodyJson, summary, linkUrl, mediaUrl, mediaAlt, scheduledAt, audience } =
    parsed.data;
  const bodyText = plainTextFromDocument(bodyJson);

  const roleKey = (await publishingRoleFor(user, entityId)) ?? "entity_publisher";
  const policy = await resolveQuotaPolicy(entityId, roleKey);
  if (!policy) {
    return { ok: false, errors: { _form: "No publishing quota is configured for your role." } };
  }

  const audienceOptions = await availableAudiencesFor(user, entityId);
  const audienceDecision = await resolveSubmittedAudience(audienceOptions, audience);
  if (!audienceDecision.ok) {
    return { ok: false, errors: { audience: audienceDecision.error } };
  }
  const audiences = audienceDecision.audiences;

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

  const { post, status } = await serializableTransaction(async (tx) => {
    const status = await decidePublishStatus(tx, user.id, policy, scheduledAt);

    const post = await tx.post.create({
      data: {
        slug,
        authorId: user.id,
        publisherEntityId: entityId,
        termLabel: currentTermLabel(),
        title,
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

    return { post, status };
  });

  await withAudit(
    userActor(user),
    auditActionFor(status),
    { type: "post", id: post.id, entityId },
    {
      title,
      quotaPeriod: policy.periodLabel,
      quotaMax: policy.maxPosts,
      ...(status === PostStatus.SCHEDULED ? { scheduledAt: scheduledAt!.toISOString() } : {}),
    },
    async () => undefined
  );

  revalidateTag("feed", "max");
  revalidatePath("/feed");
  revalidatePath("/profile");
  if (status === PostStatus.IN_REVIEW) revalidatePath("/admin/queue");

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

  const { title, bodyJson, summary, linkUrl } = parsed.data;
  const bodyText = plainTextFromDocument(bodyJson);
  const roleKey = (await publishingRoleFor(user, post.publisherEntityId)) ?? "entity_publisher";
  const policy = await resolveQuotaPolicy(post.publisherEntityId, roleKey);
  if (!policy)
    return { ok: false, errors: { _form: "No publishing quota is configured for your role." } };

  const materializedBodyJson = await materializeInlineImages(bodyJson, user.id);

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
        summary: summary?.trim() || excerptFrom(bodyText),
        bodyJson: materializedBodyJson as unknown as Prisma.InputJsonValue,
        bodyText,
        readingMinutes: readingMinutes(bodyText),
        linkUrl: linkUrl || null,
        status,
        rejectionReason: null,
        quotaPeriod: policy.periodLabel,
        publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
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
    // decidePublishStatus only returns this when given a scheduledAt, which
    // resubmission never passes — guards against silently writing a
    // SCHEDULED post with no scheduledAt set if that ever changes.
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
  if (status === PostStatus.IN_REVIEW) revalidatePath("/admin/queue");

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
      revalidatePath("/admin/queue");
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
      revalidatePath("/admin/queue");
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
      revalidatePath("/admin/posts");
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
      revalidatePath("/admin/posts");
      return { ok: true as const };
    }
  );
}
