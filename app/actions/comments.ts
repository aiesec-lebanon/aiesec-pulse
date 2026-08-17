"use server";

import { revalidatePath } from "next/cache";

import { CommentStatus, PostStatus } from "@/app/generated/prisma/enums";
import { userActor, withAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { audienceFilter, scopeSetFor } from "@/lib/org/scope";
import { checkRateLimit, retryMessage } from "@/lib/rate-limit";
import { checkPermission, requireSession } from "@/lib/rbac/guards";
import { createCommentSchema, hideContentSchema } from "@/lib/zod-schemas";
import { type CommentDto, toCommentDto } from "@/types/comment";

const commentSelect = {
  id: true,
  body: true,
  status: true,
  createdAt: true,
  user: {
    select: { fullName: true, primaryEntity: { select: { name: true } } },
  },
} as const;

export async function addComment(
  postId: string,
  content: string
): Promise<{ ok: true; comment: CommentDto } | { ok: false; error: string }> {
  const user = await requireSession();

  const authorised = await checkPermission("comment.create");
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const limit = await checkRateLimit("comment", user.id);
  if (!limit.allowed) return { ok: false, error: retryMessage(limit) };

  const restricted = await db.userRestriction.findFirst({
    where: {
      userId: user.id,
      kind: { in: ["commenting", "posting"] },
      startsAt: { lte: new Date() },
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    select: { reason: true },
  });
  if (restricted) return { ok: false, error: `Commenting is restricted: ${restricted.reason}` };

  const parsed = createCommentSchema.safeParse({ content });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment." };
  }

  // Without the audience check a member could comment on a post targeted
  // away from them by guessing its id.
  const scope = await scopeSetFor(user);
  const post = await db.post.findFirst({
    where: { id: postId, status: PostStatus.PUBLISHED, ...audienceFilter(scope) },
    select: { id: true, slug: true, publisherEntityId: true },
  });
  if (!post) return { ok: false, error: "That post is no longer available." };

  const comment = await db.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: { postId, userId: user.id, body: parsed.data.content },
      select: commentSelect,
    });
    await tx.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
    return created;
  });

  await withAudit(
    userActor(user),
    "comment.created",
    { type: "comment", id: comment.id, entityId: post.publisherEntityId },
    { postId },
    async () => undefined
  );

  revalidatePath(`/posts/${post.slug}`);
  return { ok: true, comment: toCommentDto(comment) };
}

export async function loadMoreComments(
  postId: string,
  cursorCreatedAt: string
): Promise<CommentDto[]> {
  const user = await requireSession();

  const scope = await scopeSetFor(user);
  const visible = await db.post.findFirst({
    where: { id: postId, status: PostStatus.PUBLISHED, ...audienceFilter(scope) },
    select: { id: true },
  });
  if (!visible) return [];

  const rows = await db.comment.findMany({
    where: {
      postId,
      status: { not: CommentStatus.HIDDEN },
      createdAt: { lt: new Date(cursorCreatedAt) },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: commentSelect,
  });

  return rows.map(toCommentDto);
}

/** Soft: the row becomes a tombstone so replies do not orphan. */
export async function deleteOwnComment(
  commentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireSession();

  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: {
      userId: true,
      postId: true,
      post: { select: { slug: true, publisherEntityId: true } },
    },
  });
  if (!comment) return { ok: false, error: "Comment not found." };
  if (comment.userId !== user.id)
    return { ok: false, error: "You can only delete your own comments." };

  return withAudit(
    userActor(user),
    "comment.deleted_own",
    { type: "comment", id: commentId, entityId: comment.post.publisherEntityId },
    null,
    async () => {
      await db.$transaction(async (tx) => {
        await tx.comment.update({
          where: { id: commentId },
          data: { status: CommentStatus.DELETED, deletedAt: new Date() },
        });
        await tx.post.update({
          where: { id: comment.postId },
          data: { commentCount: { decrement: 1 } },
        });
      });
      revalidatePath(`/posts/${comment.post.slug}`);
      return { ok: true as const };
    }
  );
}

export async function hideComment(
  commentId: string,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { postId: true, post: { select: { slug: true, publisherEntityId: true } } },
  });
  if (!comment) return { ok: false, error: "Comment not found." };

  const authorised = await checkPermission("moderation.hide", {
    type: "ENTITY",
    entityId: comment.post.publisherEntityId,
  });
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const parsed = hideContentSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: "Reason must be 5–500 characters." };

  return withAudit(
    userActor(authorised.user),
    "comment.hidden",
    { type: "comment", id: commentId, entityId: comment.post.publisherEntityId },
    { reason: parsed.data.reason },
    async () => {
      await db.$transaction(async (tx) => {
        await tx.comment.update({
          where: { id: commentId },
          data: {
            status: CommentStatus.HIDDEN,
            hiddenAt: new Date(),
            hiddenReason: parsed.data.reason,
          },
        });
        await tx.post.update({
          where: { id: comment.postId },
          data: { commentCount: { decrement: 1 } },
        });
      });
      revalidatePath(`/posts/${comment.post.slug}`);
      revalidatePath("/admin/comments");
      return { ok: true as const };
    }
  );
}

export async function restoreComment(
  commentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: {
      postId: true,
      status: true,
      post: { select: { slug: true, publisherEntityId: true } },
    },
  });
  if (!comment) return { ok: false, error: "Comment not found." };

  const authorised = await checkPermission("moderation.restore", {
    type: "ENTITY",
    entityId: comment.post.publisherEntityId,
  });
  if (!authorised.ok) return { ok: false, error: authorised.error };
  if (comment.status !== CommentStatus.HIDDEN) {
    return { ok: false, error: "Only hidden comments can be restored." };
  }

  return withAudit(
    userActor(authorised.user),
    "comment.restored",
    { type: "comment", id: commentId, entityId: comment.post.publisherEntityId },
    null,
    async () => {
      await db.$transaction(async (tx) => {
        await tx.comment.update({
          where: { id: commentId },
          data: { status: CommentStatus.VISIBLE, hiddenAt: null, hiddenReason: null },
        });
        await tx.post.update({
          where: { id: comment.postId },
          data: { commentCount: { increment: 1 } },
        });
      });
      revalidatePath(`/posts/${comment.post.slug}`);
      revalidatePath("/admin/comments");
      return { ok: true as const };
    }
  );
}
