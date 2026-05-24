"use server";

import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function toggleLike(
  postId: string,
): Promise<{ liked: boolean; count: number }> {
  const user = await requireUser();

  const existing = await db.like.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
  });

  if (existing) {
    await db.like.delete({
      where: { postId_userId: { postId, userId: user.id } },
    });
  } else {
    await db.like.create({ data: { postId, userId: user.id } });
  }

  const count = await db.like.count({ where: { postId } });
  return { liked: !existing, count };
}
