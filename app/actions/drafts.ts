"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus } from "@/app/generated/prisma/enums";
import { userActor, withAudit } from "@/lib/audit";
import {
  excerptFrom,
  guessMimeType,
  plainTextFromDocument,
  readingMinutes,
} from "@/lib/content/document";
import { uniqueSlug } from "@/lib/content/slug";
import { db } from "@/lib/db";
import { mediaUrl as resolveCoverUrl } from "@/lib/feed";
import { defaultAudience } from "@/lib/org/scope";
import { checkRateLimit, retryMessage } from "@/lib/rate-limit";
import { checkPermission, requireSession } from "@/lib/rbac/guards";
import { currentTermLabel } from "@/lib/term";
import { fieldErrors, type SaveDraftInput, saveDraftSchema } from "@/lib/zod-schemas";

export type SaveDraftResult =
  | { ok: true; postId: string; slug: string }
  | { ok: false; errors: Record<string, string> };

/**
 * Create-or-update a `Post{status: DRAFT}` + a `PostVersion` snapshot.
 * Inline images inside `bodyJson` are deliberately left as the raw upload URL
 * here (not run through materialisation) — this is called on a 5-second
 * autosave cadence, and there is no channel to hand a rewritten mediaId back
 * to an actively-typing TipTap instance without disturbing it. Materialising
 * to a real Media row happens once, at actual publish time (see
 * `lib/content/publish.ts`). The cover image has no such constraint (it's a
 * plain `useState`, not an uncontrolled editor), so it's resolved eagerly
 * below, idempotently, so re-saving the same attached image on every tick
 * doesn't mint a new Media row each time.
 */
export async function saveDraft(input: SaveDraftInput, postId?: string): Promise<SaveDraftResult> {
  const user = await requireSession();

  const entityId = user.primaryEntityId;
  if (!entityId) {
    return {
      ok: false,
      errors: { _form: "Your AIESEC entity is not on record yet. Sign out and back in." },
    };
  }

  const authorised = await checkPermission("post.draft");
  if (!authorised.ok) return { ok: false, errors: { _form: authorised.error } };

  const limit = await checkRateLimit("draftAutosave", user.id);
  if (!limit.allowed) return { ok: false, errors: { _form: retryMessage(limit) } };

  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const { title, bodyJson, summary, linkUrl, mediaUrl, mediaAlt } = parsed.data;
  const bodyText = plainTextFromDocument(bodyJson);
  const summaryValue = summary?.trim() || (bodyText ? excerptFrom(bodyText) : null);

  let existing: {
    id: string;
    coverMediaId: string | null;
    cover: { bucket: string; path: string } | null;
  } | null = null;

  if (postId) {
    const found = await db.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        status: true,
        coverMediaId: true,
        cover: { select: { bucket: true, path: true } },
      },
    });
    if (!found || found.authorId !== user.id) {
      return { ok: false, errors: { _form: "Draft not found." } };
    }
    if (found.status !== PostStatus.DRAFT) {
      return { ok: false, errors: { _form: "Only drafts can be saved this way." } };
    }
    existing = found;
  }

  let coverMediaId: string | null = existing?.coverMediaId ?? null;
  if (mediaUrl) {
    const currentUrl = existing?.cover ? resolveCoverUrl(existing.cover) : null;
    if (currentUrl !== mediaUrl) {
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
  } else {
    coverMediaId = null;
  }

  const slug = existing ? null : await uniqueSlug(title || "untitled-draft");

  const post = await db.$transaction(async (tx) => {
    if (existing) {
      const latest = await tx.postVersion.findFirst({
        where: { postId: existing.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      return tx.post.update({
        where: { id: existing.id },
        data: {
          title,
          summary: summaryValue,
          bodyJson: bodyJson as unknown as Prisma.InputJsonValue,
          bodyText,
          readingMinutes: readingMinutes(bodyText),
          coverMediaId,
          linkUrl: linkUrl || null,
          versions: {
            create: {
              version: (latest?.version ?? 0) + 1,
              title,
              summary: summaryValue,
              bodyJson: bodyJson as unknown as Prisma.InputJsonValue,
              editedById: user.id,
            },
          },
        },
        select: { id: true, slug: true },
      });
    }

    return tx.post.create({
      data: {
        slug: slug!,
        authorId: user.id,
        publisherEntityId: entityId,
        termLabel: currentTermLabel(),
        title,
        summary: summaryValue,
        bodyJson: bodyJson as unknown as Prisma.InputJsonValue,
        bodyText,
        readingMinutes: readingMinutes(bodyText),
        coverMediaId,
        linkUrl: linkUrl || null,
        status: PostStatus.DRAFT,
        audiences: { create: defaultAudience() },
        versions: {
          create: {
            version: 1,
            title,
            summary: summaryValue,
            bodyJson: bodyJson as unknown as Prisma.InputJsonValue,
            editedById: user.id,
          },
        },
      },
      select: { id: true, slug: true },
    });
  });

  if (!existing) {
    await withAudit(
      userActor(user),
      "post.draft_created",
      { type: "post", id: post.id, entityId },
      { title },
      async () => undefined
    );
  }

  revalidatePath("/drafts");
  return { ok: true, postId: post.id, slug: post.slug };
}

/** Author-only, DRAFT-only — matches deleteOwnComment's ownership-only gate. */
export async function deleteDraft(
  postId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireSession();

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { authorId: true, status: true, publisherEntityId: true, title: true },
  });
  if (!post || post.authorId !== user.id) return { ok: false, error: "Draft not found." };
  if (post.status !== PostStatus.DRAFT) {
    return { ok: false, error: "Only drafts can be deleted this way." };
  }

  return withAudit(
    userActor(user),
    "post.draft_deleted",
    { type: "post", id: postId, entityId: post.publisherEntityId },
    { title: post.title },
    async () => {
      // Hard delete, not hidden/archived: an unpublished draft was never seen
      // by anyone but its author, so the reversible-moderation principle
      // (architecture.md §1.8) doesn't apply — retention.ts already
      // hard-deletes stale drafts the same way.
      await db.post.delete({ where: { id: postId } });
      revalidatePath("/drafts");
      return { ok: true as const };
    }
  );
}

export type MyDraft = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  bodyText: string;
  updatedAt: Date;
};

export async function listMyDrafts(): Promise<MyDraft[]> {
  const user = await requireSession();

  return db.post.findMany({
    where: { authorId: user.id, status: PostStatus.DRAFT },
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, title: true, summary: true, bodyText: true, updatedAt: true },
  });
}
