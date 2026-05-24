"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function toggleLike(
  postId: string,
): Promise<{ liked: boolean; count: number }> {
  const user = await requireUser();

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
    });

    if (existing) {
      await tx.like.delete({
        where: { postId_userId: { postId, userId: user.id } },
      });
    } else {
      await tx.like.create({ data: { postId, userId: user.id } });
    }

    const count = await tx.like.count({ where: { postId } });
    return { liked: !existing, count };
  });

  revalidatePath(`/posts/${postId}`);
  revalidatePath("/feed");

  return result;
}
