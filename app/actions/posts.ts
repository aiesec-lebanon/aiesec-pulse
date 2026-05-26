"use server";

import { revalidatePath } from "next/cache";
import { requireMCP } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { currentIsoWeek } from "@/lib/week";
import { createPostSchema, type CreatePostInput } from "@/lib/zod-schemas";
import { PostStatus } from "@/app/generated/prisma/enums";
import { checkPostRateLimit } from "@/lib/auth/rate-limit";

export type CreatePostResult =
  | { ok: true; postId: string; status: "PUBLISHED" | "PENDING" }
  | { ok: false; errors: Record<string, string> };

export async function createPost(input: CreatePostInput): Promise<CreatePostResult> {
  const user = await requireMCP();

  if (!checkPostRateLimit(user.id)) {
    return { ok: false, errors: { _form: "Too many submissions. Please wait a moment and try again." } };
  }

  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
      const msg = (messages as string[] | undefined)?.[0];
      if (msg) errors[field] = msg;
    }
    return { ok: false, errors };
  }

  const { title, content, mediaUrl, linkUrl } = parsed.data;
  const weekIso = currentIsoWeek();

  // Serializable isolation prevents two simultaneous submissions at count=1
  // from both observing count<2 and both publishing.
  const { post, status } = await db.$transaction(
    async (tx) => {
      const count = await tx.post.count({
        where: {
          authorId: user.id,
          weekIso,
          status: { in: [PostStatus.PUBLISHED, PostStatus.PENDING] },
        },
      });
      const status = count < 2 ? PostStatus.PUBLISHED : PostStatus.PENDING;
      const post = await tx.post.create({
        data: {
          authorId: user.id,
          title,
          content,
          mediaUrl: mediaUrl || null,
          linkUrl: linkUrl || null,
          status,
          weekIso,
        },
      });
      return { post, status };
    },
    { isolationLevel: "Serializable" },
  );

  revalidatePath("/feed");
  revalidatePath("/posts/new");
  if (status === PostStatus.PENDING) revalidatePath("/admin/queue");

  return { ok: true, postId: post.id, status };
}

export async function deletePost(_postId: string) {
  throw new Error("deletePost not yet implemented");
}

export async function approvePost(_postId: string) {
  throw new Error("approvePost not yet implemented");
}

export async function rejectPost(_postId: string, _reason: string) {
  throw new Error("rejectPost not yet implemented");
}
