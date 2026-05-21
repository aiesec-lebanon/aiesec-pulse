import { z } from "zod";

// TODO: define and export all Zod schemas used by Server Actions and Route Handlers.
// One schema serves both client-side form validation and server-side guard.

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  mediaUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
});

export const AddCommentSchema = z.object({
  postId: z.string().cuid(),
  content: z.string().min(1).max(2000),
});

export const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RejectPostSchema = z.object({
  postId: z.string().cuid(),
  reason: z.string().min(1).max(500),
});
