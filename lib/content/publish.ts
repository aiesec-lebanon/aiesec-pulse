import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus } from "@/app/generated/prisma/enums";
import {
  type BlockNode,
  CONTAINER_BLOCK_TYPES,
  guessMimeType,
  isSafeHref,
  type PulseDocument,
} from "@/lib/content/document";
import { db } from "@/lib/db";
import type { ResolvedQuota } from "@/lib/quota";
import { usedInPeriod } from "@/lib/quota";
import { can } from "@/lib/rbac/can";

// Shared by every path that turns a submission into a PUBLISHED/IN_REVIEW
// post — createPost, resubmitPost, and publishDraft. Not exported from a
// "use server" action module because these aren't themselves guarded
// entry points: they're internals the caller has already authorised, and
// guessMimeType/CONTAINER_BLOCK_TYPES walking is plain sync/async utility
// code that "use server" files aren't allowed to export directly.

export async function publishingRoleFor(
  user: { id: string },
  entityId: string
): Promise<string | null> {
  if (await can(user, "post.publish", { type: "ENTITY", entityId })) {
    const grants = await db.roleGrant.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        role: {
          key: { in: ["platform_admin", "global_publisher", "entity_editor", "entity_publisher"] },
        },
      },
      select: { role: { select: { key: true } } },
    });
    // Most permissive first: an editor who also publishes gets the wider allowance.
    for (const key of ["platform_admin", "global_publisher", "entity_editor", "entity_publisher"]) {
      if (grants.some((g) => g.role.key === key)) return key;
    }
  }
  return null;
}

/**
 * The rich-text editor's image toolbar uploads directly to storage before a
 * post exists (components/editor/RichTextEditor.tsx), so an inline image
 * block's `mediaId` is actually just the upload's public URL until the post
 * is submitted. This walks the document once at submit time, creates one
 * real Media row per distinct upload URL, and rewrites `mediaId` to the
 * created row's id. A `mediaId` that isn't an http(s) URL already names a
 * real Media row (unchanged content from a prior version, or a resubmit) and
 * is left alone.
 */
export async function materializeInlineImages(
  doc: PulseDocument,
  userId: string
): Promise<PulseDocument> {
  const createdForUrl = new Map<string, string>();

  async function walk(node: BlockNode): Promise<BlockNode> {
    if (node.type === "image") {
      if (!isSafeHref(node.attrs.mediaId)) return node;

      let mediaId = createdForUrl.get(node.attrs.mediaId);
      if (!mediaId) {
        const media = await db.media.create({
          data: {
            ownerId: userId,
            bucket: "post-media",
            path: node.attrs.mediaId.replace(/^.*\/post-media\//, ""),
            mimeType: guessMimeType(node.attrs.mediaId),
            bytes: 0,
            altText: node.attrs.alt,
          },
          select: { id: true },
        });
        mediaId = media.id;
        createdForUrl.set(node.attrs.mediaId, mediaId);
      }
      return { type: "image", attrs: { mediaId, alt: node.attrs.alt } };
    }

    if (CONTAINER_BLOCK_TYPES.has(node.type) && "content" in node && Array.isArray(node.content)) {
      const content = await Promise.all((node.content as BlockNode[]).map(walk));
      return { ...node, content } as BlockNode;
    }

    return node;
  }

  const content = await Promise.all(doc.content.map(walk));
  return { type: "doc", content };
}

/**
 * The quota-resolution step duplicated across createPost, resubmitPost, and
 * publishDraft's transactions: whoever submits while under quota publishes
 * immediately (or schedules, if a future `scheduledAt` was given), the rest
 * queue. A scheduled post still consumes quota at submit time
 * (architecture.md §8.2) — `lib/quota.ts`'s `QUOTA_CONSUMING_STATUSES`
 * already counts SCHEDULED alongside PUBLISHED and IN_REVIEW, so nothing
 * here needs to special-case it. Takes a transaction client so the
 * read-then-write stays inside the caller's serializable transaction.
 */
export async function decidePublishStatus(
  tx: Prisma.TransactionClient | typeof db,
  userId: string,
  policy: ResolvedQuota,
  scheduledAt: Date | null = null
): Promise<
  typeof PostStatus.PUBLISHED | typeof PostStatus.IN_REVIEW | typeof PostStatus.SCHEDULED
> {
  const used = await usedInPeriod(tx, userId, policy.periodLabel);
  if (used >= policy.maxPosts) return PostStatus.IN_REVIEW;
  return scheduledAt ? PostStatus.SCHEDULED : PostStatus.PUBLISHED;
}

/** Shared by createPost and publishDraft so the same outcome reads the same in the audit log. */
export function auditActionFor(
  status: typeof PostStatus.PUBLISHED | typeof PostStatus.IN_REVIEW | typeof PostStatus.SCHEDULED
): string {
  if (status === PostStatus.PUBLISHED) return "post.published";
  if (status === PostStatus.SCHEDULED) return "post.scheduled";
  return "post.queued";
}
