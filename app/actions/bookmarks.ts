"use server";

import { revalidatePath } from "next/cache";

import { PostStatus } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { scopeSetFor, visibilityFilter } from "@/lib/org/scope";
import { requireSession } from "@/lib/rbac/guards";

// Re-checked because postId is caller-supplied — same rule as toggleReaction.
export async function toggleBookmark(
  postId: string
): Promise<{ ok: true; bookmarked: boolean } | { ok: false; error: string }> {
  const user = await requireSession();

  const scope = await scopeSetFor(user);
  const post = await db.post.findFirst({
    where: { id: postId, status: PostStatus.PUBLISHED, ...visibilityFilter(scope) },
    select: { id: true, slug: true },
  });
  if (!post) return { ok: false, error: "That post is no longer available." };

  const where = { userId_postId: { userId: user.id, postId } };
  const existing = await db.bookmark.findUnique({ where, select: { userId: true } });

  if (existing) {
    await db.bookmark.delete({ where });
  } else {
    await db.bookmark.create({ data: { userId: user.id, postId } });
  }

  revalidatePath(`/posts/${post.slug}`);
  revalidatePath("/bookmarks");

  return { ok: true, bookmarked: !existing };
}
