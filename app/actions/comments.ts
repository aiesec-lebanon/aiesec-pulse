"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { withAudit } from "@/lib/audit";
import { type CommentDto, toCommentDto } from "@/types/comment";

const createCommentSchema = z.object({ content: z.string().min(1).max(2000) });

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_MAX) return false;
  bucket.count++;
  return true;
}

const commentSelect = {
  id: true,
  content: true,
  deletedAt: true,
  createdAt: true,
  user: { select: { fullName: true, committeeName: true } },
} as const;

export async function addComment(
  postId: string,
  content: string,
): Promise<{ ok: true; comment: CommentDto } | { ok: false; error: string }> {
  const user = await requireUser();

  const parsed = createCommentSchema.safeParse({ content });
  if (!parsed.success) {
    return { ok: false, error: "Comment must be between 1 and 2000 characters." };
  }

  if (!checkRateLimit(user.id)) {
    return { ok: false, error: "You're posting too fast. Please wait a moment." };
  }

  const comment = await db.comment.create({
    data: { postId, userId: user.id, content: parsed.data.content },
    select: commentSelect,
  });

  revalidatePath(`/posts/${postId}`);

  return { ok: true, comment: toCommentDto(comment) };
}

export async function loadMoreComments(
  postId: string,
  cursorCreatedAt: string,
): Promise<CommentDto[]> {
  await requireUser();

  const rows = await db.comment.findMany({
    where: { postId, createdAt: { lt: new Date(cursorCreatedAt) } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: commentSelect,
  });

  return rows.map(toCommentDto);
}

export async function deleteComment(commentId: string) {
  const admin = await requireAdmin();
  return withAudit(admin, "delete_comment", "comment", commentId, null, async () => {
    const comment = await db.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
      select: { postId: true },
    });
    revalidatePath(`/posts/${comment.postId}`);
    revalidatePath("/admin/comments");
  });
}
