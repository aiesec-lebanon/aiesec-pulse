"use server";

import { revalidatePath } from "next/cache";
import { requireMCP, requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { withAudit, logUserAction } from "@/lib/audit";
import { currentIsoWeek } from "@/lib/week";
import { createPostSchema, rejectPostSchema, type CreatePostInput } from "@/lib/zod-schemas";
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

  await logUserAction(user.id, "create_post", "post", post.id, { title, status });

  revalidatePath("/feed");
  revalidatePath("/posts/new");
  if (status === PostStatus.PENDING) revalidatePath("/admin/queue");

  return { ok: true, postId: post.id, status };
}

export async function approvePost(postId: string): Promise<{ ok: true }> {
  const admin = await requireAdmin();
  return withAudit(admin, "approve_post", "post", postId, null, async () => {
    await db.post.update({ where: { id: postId }, data: { status: PostStatus.PUBLISHED } });
    revalidatePath("/admin/queue");
    revalidatePath("/feed");
    return { ok: true as const };
  });
}

export async function rejectPost(
  postId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const parsed = rejectPostSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: "Reason must be 5-500 characters." };
  return withAudit(admin, "reject_post", "post", postId, { reason: parsed.data.reason }, async () => {
    await db.post.update({
      where: { id: postId },
      data: { status: PostStatus.REJECTED, rejectionReason: parsed.data.reason },
    });
    revalidatePath("/admin/queue");
    revalidatePath("/feed");
    return { ok: true as const };
  });
}

export type ResubmitPostResult =
  | { ok: true; status: "PUBLISHED" | "PENDING" }
  | { ok: false; errors: Record<string, string> };

export async function resubmitPost(
  postId: string,
  input: CreatePostInput,
): Promise<ResubmitPostResult> {
  const user = await requireMCP();

  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
      const msg = (messages as string[] | undefined)?.[0];
      if (msg) errors[field] = msg;
    }
    return { ok: false, errors };
  }

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { authorId: true, status: true },
  });

  if (!post || post.authorId !== user.id) {
    return { ok: false, errors: { _form: "Post not found." } };
  }
  if (post.status !== PostStatus.REJECTED) {
    return { ok: false, errors: { _form: "Only rejected posts can be resubmitted." } };
  }

  const { title, content, mediaUrl, linkUrl } = parsed.data;
  const weekIso = currentIsoWeek();

  const { status } = await db.$transaction(
    async (tx) => {
      const count = await tx.post.count({
        where: {
          authorId: user.id,
          weekIso,
          status: { in: [PostStatus.PUBLISHED, PostStatus.PENDING] },
        },
      });
      const status = count < 2 ? PostStatus.PUBLISHED : PostStatus.PENDING;
      await tx.post.update({
        where: { id: postId },
        data: {
          title,
          content,
          mediaUrl: mediaUrl || null,
          linkUrl: linkUrl || null,
          status,
          rejectionReason: null,
          weekIso,
        },
      });
      return { status };
    },
    { isolationLevel: "Serializable" },
  );

  revalidatePath("/profile");
  revalidatePath("/feed");
  if (status === PostStatus.PENDING) revalidatePath("/admin/queue");

  return { ok: true, status };
}

export async function deletePost(postId: string) {
  const admin = await requireAdmin();
  const target = await db.post.findUnique({ where: { id: postId }, select: { title: true } });
  return withAudit(admin, "delete_post", "post", postId, { title: target?.title }, async () => {
    await db.post.delete({ where: { id: postId } });
    revalidatePath("/feed");
    revalidatePath("/admin/posts");
    revalidatePath("/admin/queue");
  });
}
