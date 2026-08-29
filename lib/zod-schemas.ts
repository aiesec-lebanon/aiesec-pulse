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

// Composer sends a UTC ISO instant (lib/timezone.ts) — this only re-checks
// shape and futurity; nothing client-computed is trusted as-is.
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

// Absent means "use the default for this publisher"
// (lib/org/scope.ts's decideAudienceForSubmission) — re-validated against
// the publisher's real scope server-side regardless of what's sent here.
const audienceField = z
  .object({
    scopeType: z.enum(["GLOBAL", "REGION", "ENTITY"]),
    entityId: z.string().trim().min(1).nullable(),
  })
  .optional();

// Absent means "no topics"; updates re-send the full set, never merged —
// exactly what the picker showed. An id naming no real Topic is silently
// dropped server-side (lib/content/topics.ts's resolveValidTopicIds), not rejected.
const topicIdsField = z.array(z.string().trim().min(1)).max(20).optional();

// Sanitised here too, not just on read — a document arriving as a Server
// Action argument is untrusted input like any other (lib/content/document.ts).
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
    // The highlighted phrase, stored as a substring not an offset pair —
    // editing the headline can't corrupt it, and a vanished phrase is
    // simply ignored at render, not mis-highlighted.
    titleAccent: z.string().trim().max(200, "Highlights are limited to 200 characters").optional(),
    bodyJson: bodyJsonField,
    summary: z.string().trim().max(400, "Summaries are limited to 400 characters").optional(),
    linkUrl: optionalHttpUrl,
    mediaUrl: optionalHttpUrl,
    mediaAlt: z.string().trim().max(300, "Alt text is limited to 300 characters").optional(),
    scheduledAt: scheduledAtField,
    audience: audienceField,
    topicIds: topicIdsField,
    // Reach chosen at publication; ignored unless the publisher can
    // actually promote — the server re-derives that, this is just the ask.
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

// z.input, not z.infer — this is what a caller sends before validation.
// scheduledAt's input is a string, not the `Date` its transform produces;
// z.infer would silently mistype it (bodyJson only "worked" by coincidence).
export type CreatePostInput = z.input<typeof createPostSchema>;

// Deliberately lenient — a draft must be saveable half-finished ("leave
// and return to it"), so no length minimums or alt-text-required rule.
// createPostSchema re-enforces full completeness on publish.
const draftBodyJsonField = z
  .unknown()
  .transform((value): PulseDocument => sanitiseDocument(value))
  .refine((doc) => plainTextFromDocument(doc).length <= 50_000, {
    message: "Posts are limited to 50,000 characters",
  });

export const saveDraftSchema = z.object({
  title: z.string().trim().max(200, "Titles are limited to 200 characters").default(""),
  titleAccent: z.string().trim().max(200, "Highlights are limited to 200 characters").optional(),
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
 * Mandatory — the promotion quota is always spent against a stated
 * reason, so the audit record says why, not just that it happened.
 */
export const promotePostSchema = z.object({
  note: z
    .string()
    .trim()
    .min(5, "Say why this is worth the whole network's attention")
    .max(500, "Notes are limited to 500 characters"),
});

/**
 * A member's own standfirst. Empty clears it — "remove my bio" must be
 * expressible, so no minimum length.
 */
export const updateBioSchema = z.object({
  bio: z.string().trim().max(280, "Keep your bio to 280 characters or fewer"),
});
export type UpdateBioInput = z.infer<typeof updateBioSchema>;

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
