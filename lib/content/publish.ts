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
import { type PermissionKey, PUBLISHING_TIERS, type RoleKey } from "@/lib/rbac/catalogue";

// Shared by createPost/resubmitPost/publishDraft. Not in a "use server"
// module: these are internals the caller has already authorised, and
// "use server" files may only export async functions.

/**
 * Widest publishing tier the user holds at `entityId`, provided they may
 * exercise `permission` there — null is a refusal, not a fallback to the
 * narrowest tier. Takes `permission` (not just `post.publish`) since
 * promotion is budgeted the same way against a different capability.
 */
export async function quotaRoleFor(
  user: { id: string },
  entityId: string,
  permission: PermissionKey = "post.publish"
): Promise<RoleKey | null> {
  if (await can(user, permission, { type: "ENTITY", entityId })) {
    const grants = await db.roleGrant.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        role: { key: { in: [...PUBLISHING_TIERS] } },
      },
      select: { role: { select: { key: true } } },
    });
    // Most permissive first: an MCVP who is also an LCP gets the wider allowance.
    for (const key of PUBLISHING_TIERS) {
      if (grants.some((g) => g.role.key === key)) return key;
    }
  }
  return null;
}

/**
 * Editor image uploads go straight to storage before the post exists, so
 * `mediaId` is really the upload URL until submit. Walks the doc once,
 * creates one Media row per distinct URL, and rewrites `mediaId` to it.
 * Non-URL mediaIds already name a real row (resubmit) and are left alone.
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
 * Shared quota-resolution step: under quota publishes (or schedules) now,
 * else queues. Scheduled posts still consume quota at submit time (see
 * `QUOTA_CONSUMING_STATUSES`), no special-casing needed here. Takes a tx
 * client so read-then-write stays inside the caller's transaction.
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

/** Shared by createPost and publishDraft so audit log outcomes read the same. */
export function auditActionFor(
  status: typeof PostStatus.PUBLISHED | typeof PostStatus.IN_REVIEW | typeof PostStatus.SCHEDULED
): string {
  if (status === PostStatus.PUBLISHED) return "post.published";
  if (status === PostStatus.SCHEDULED) return "post.scheduled";
  return "post.queued";
}
