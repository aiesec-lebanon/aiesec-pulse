"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { PostStatus, ReactionKind } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { audienceFilter, scopeSetFor } from "@/lib/org/scope";
import { requireSession } from "@/lib/rbac/guards";

// Visibility is re-checked because reacting is a write against a caller-supplied
// post id. reactionCount is maintained in the same transaction as the row.
export async function toggleReaction(
  postId: string
): Promise<{ ok: true; reacted: boolean; count: number } | { ok: false; error: string }> {
  const user = await requireSession();

  const scope = await scopeSetFor(user);
  const post = await db.post.findFirst({
    where: { id: postId, status: PostStatus.PUBLISHED, ...audienceFilter(scope) },
    select: { id: true, slug: true },
  });
  if (!post) return { ok: false, error: "That post is no longer available." };

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.reaction.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
      select: { postId: true },
    });

    if (existing) {
      await tx.reaction.delete({ where: { postId_userId: { postId, userId: user.id } } });
    } else {
      await tx.reaction.create({ data: { postId, userId: user.id, kind: ReactionKind.LIKE } });
    }

    // Recount inside the transaction rather than incrementing blindly: a double
    // submit would otherwise drift the counter away from the rows permanently.
    const count = await tx.reaction.count({ where: { postId } });
    await tx.post.update({ where: { id: postId }, data: { reactionCount: count } });

    return { reacted: !existing, count };
  });

  revalidatePath(`/posts/${post.slug}`);
  revalidateTag("feed", "max");

  return { ok: true, ...result };
}
