import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(10).max(10000),
  linkUrl: z.string().url().optional().or(z.literal("")),
  mediaUrl: z.string().url().optional().or(z.literal("")),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const rejectPostSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});
export type RejectPostInput = z.infer<typeof rejectPostSchema>;
