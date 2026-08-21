import { z } from "zod";

import {
  plainTextFromDocument,
  type PulseDocument,
  sanitiseDocument,
} from "@/lib/content/document";

// z.string().url() alone accepts javascript: and data:, which become XSS once
// the value reaches an href. Mirrored for link marks in content/document.ts.
const httpUrl = z
  .string()
  .trim()
  .url("Enter a valid link starting with http:// or https://")
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Links must start with http:// or https://");

const optionalHttpUrl = z.union([httpUrl, z.literal("")]).optional();

// The composer sends an ISO instant already converted to UTC client-side
// (lib/timezone.ts) — this only re-checks shape and futurity, the way every
// other client-computed value here is still validated server-side rather
// than trusted.
const scheduledAtField = z
  .string()
  .trim()
  .optional()
  .transform((value): Date | null => (value ? new Date(value) : null))
  .refine((date) => date === null || !Number.isNaN(date.getTime()), {
    message: "Enter a valid date and time",
  })
  .refine((date) => date === null || date.getTime() > Date.now(), {
    message: "Scheduled time must be in the future",
  });

// Absent entirely means "use the default for what this publisher may
// target" (lib/org/scope.ts's decideAudienceForSubmission) — the composer
// only ever sends this for a publisher who actually has a picker to choose
// from; the shape itself is re-validated against that publisher's real scope
// server-side regardless of what's sent here.
const audienceField = z
  .object({
    scopeType: z.enum(["GLOBAL", "REGION", "ENTITY"]),
    entityId: z.string().trim().min(1).nullable(),
  })
  .optional();

// Absent means "no topics" on a fresh create; on an update it's re-sent in
// full each time (never merged) — a post's topics on create/publish/resubmit
// are exactly what the picker showed selected, not accumulated. An id that
// doesn't name a real, active Topic is silently dropped server-side
// (lib/content/topics.ts's resolveValidTopicIds), not rejected — a tag
// carries no authorisation weight.
const topicIdsField = z.array(z.string().trim().min(1)).max(20).optional();

// Sanitised here too, not just on read — a document arriving from a Server
// Action's argument is untrusted input like any other (lib/content/document.ts).
// Length limits are enforced against the flattened text, matching what the
// composer's own character counter shows the author.
const bodyJsonField = z
  .unknown()
  .transform((value): PulseDocument => sanitiseDocument(value))
  .refine((doc) => plainTextFromDocument(doc).trim().length >= 10, {
    message: "Write at least 10 characters",
  })
  .refine((doc) => plainTextFromDocument(doc).length <= 50_000, {
    message: "Posts are limited to 50,000 characters",
  });

export const createPostSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Give your post a title of at least 3 characters")
      .max(200, "Titles are limited to 200 characters"),
    bodyJson: bodyJsonField,
    summary: z.string().trim().max(400, "Summaries are limited to 400 characters").optional(),
    linkUrl: optionalHttpUrl,
    mediaUrl: optionalHttpUrl,
    mediaAlt: z.string().trim().max(300, "Alt text is limited to 300 characters").optional(),
    scheduledAt: scheduledAtField,
    audience: audienceField,
    topicIds: topicIdsField,
    // Reach, chosen at publication (architecture.md §8.6). Ignored unless the
    // publisher may actually promote — the server re-derives that; this is only
    // what the composer asked for.
    promoteToNetwork: z.boolean().optional(),
    promotionNote: z.string().trim().max(500, "Notes are limited to 500 characters").optional(),
  })
  .refine((data) => !data.mediaUrl || (data.mediaAlt?.trim().length ?? 0) > 0, {
    message: "Describe the image for people using a screen reader",
    path: ["mediaAlt"],
  })
  .refine((data) => !data.promoteToNetwork || (data.promotionNote?.trim().length ?? 0) >= 5, {
    // Same rule as promotePostSchema: the quota is never spent without a stated
    // reason, whichever route spends it.
    message: "Say why the network should see this — at least 5 characters",
    path: ["promotionNote"],
  });

// z.input, not z.infer/z.output: this is the parameter type for createPost/
// resubmitPost/publishDraft, i.e. what a caller sends before validation —
// scheduledAt arrives as the composer's UTC ISO string, not yet the `Date`
// the schema's transform produces. Every field here was already untransformed
// except this one; bodyJson stayed correct under z.infer only because its
// input type is `unknown`, wide enough to accept what the composer already
// holds — that coincidence doesn't extend to a field whose input and output
// types genuinely differ.
export type CreatePostInput = z.input<typeof createPostSchema>;

// Deliberately lenient: "leave and return to it" means a draft must be
// saveable in whatever half-finished state it's in — no minimum title/body
// length, and no cross-field alt-text-required rule. Full completeness is
// re-enforced by createPostSchema at the moment a draft is actually published.
const draftBodyJsonField = z
  .unknown()
  .transform((value): PulseDocument => sanitiseDocument(value))
  .refine((doc) => plainTextFromDocument(doc).length <= 50_000, {
    message: "Posts are limited to 50,000 characters",
  });

export const saveDraftSchema = z.object({
  title: z.string().trim().max(200, "Titles are limited to 200 characters").default(""),
  bodyJson: draftBodyJsonField,
  summary: z.string().trim().max(400, "Summaries are limited to 400 characters").optional(),
  linkUrl: optionalHttpUrl,
  mediaUrl: optionalHttpUrl,
  mediaAlt: z.string().trim().max(300, "Alt text is limited to 300 characters").optional(),
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(2_000, "Comments are limited to 2,000 characters"),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const rejectPostSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Give the author a reason of at least 5 characters")
    .max(500, "Reasons are limited to 500 characters"),
});
export type RejectPostInput = z.infer<typeof rejectPostSchema>;

export const hideContentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Record why this was hidden")
    .max(500, "Reasons are limited to 500 characters"),
});

/**
 * architecture.md §8.6 requires the note: the promotion quota is always spent
 * against a stated reason, so the audit record says why the network's attention
 * was bought and not only that it was.
 */
export const promotePostSchema = z.object({
  note: z
    .string()
    .trim()
    .min(5, "Say why this is worth the whole network's attention")
    .max(500, "Notes are limited to 500 characters"),
});

export const dataSubjectRequestSchema = z.object({
  kind: z.enum(["ACCESS", "EXPORT", "RECTIFICATION", "ERASURE", "OBJECTION"]),
  notes: z.string().trim().max(2_000).optional(),
});
export type DataSubjectRequestInput = z.infer<typeof dataSubjectRequestSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
