"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const contentSchema = z.string().min(1).max(2000);

export type CommentWithUser = {
  id: string;
  content: string;
  deletedAt: Date | null;
  createdAt: Date;
  user: { id: string; fullName: string };
};

const commentSelect = {
  id: true,
  content: true,
  deletedAt: true,
  createdAt: true,
  user: { select: { id: true, fullName: true } },
} as const;

export async function addComment(
  postId: string,
  content: string,
): Promise<CommentWithUser> {
  const user = await requireUser();
  const safeContent = contentSchema.parse(content);

  return db.comment.create({
    data: { postId, userId: user.id, content: safeContent },
    select: commentSelect,
  });
}

export async function loadMoreComments(
  postId: string,
  cursor: string,
): Promise<CommentWithUser[]> {
  await requireUser();

  return db.comment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    take: 20,
    skip: 1,
    cursor: { id: cursor },
    select: commentSelect,
  });
}
