import { z } from "zod";

// The privacy contact form on the privacy notice. A message is stored as a
// privacy request and read by the privacy team in the admin console, so no
// address is published and nothing leaves Pulse. Shared by the form, the
// server action and the admin queue.

export const CONTACT_LIMITS = { name: 100, email: 254, message: 4000 } as const;

export const CONTACT_TOPICS = [
  { kind: "QUESTION", label: "A question or a complaint" },
  { kind: "ACCESS", label: "Ask what you hold about me" },
  { kind: "EXPORT", label: "Send me a copy of my data" },
  { kind: "RECTIFICATION", label: "Correct something that's wrong" },
  { kind: "ERASURE", label: "Erase my data" },
  { kind: "RESTRICTION", label: "Pause the use of my data while something is checked" },
  { kind: "OBJECTION", label: "Object to how my data is used" },
] as const;

export type ContactKind = (typeof CONTACT_TOPICS)[number]["kind"];
export type ContactField = "name" | "email" | "kind" | "message";
export type ContactInput = { name: string; email: string; kind: ContactKind; message: string };

export type ContactState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; error: string; fieldErrors?: Partial<Record<ContactField, string>> };

const KINDS = CONTACT_TOPICS.map((topic) => topic.kind) as [ContactKind, ...ContactKind[]];

const shape = z.object({
  name: z.string().max(CONTACT_LIMITS.name),
  email: z.string().max(CONTACT_LIMITS.email),
  kind: z.string(),
  message: z.string().max(CONTACT_LIMITS.message),
});

const TOO_LONG: Record<ContactField, string> = {
  name: `Use ${CONTACT_LIMITS.name} characters or fewer.`,
  email: "Use a shorter email address.",
  kind: "Choose what your message is about.",
  message: `Keep your message to ${CONTACT_LIMITS.message} characters.`,
};

/** Checks a message; every field is required so the team can reply. */
export function validateContact(
  raw: unknown
):
  | { ok: true; data: ContactInput }
  | { ok: false; fieldErrors: Partial<Record<ContactField, string>> } {
  const parsed = shape.safeParse(raw ?? {});
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ContactField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as ContactField;
      if (key in TOO_LONG) fieldErrors[key] ??= TOO_LONG[key];
    }
    return {
      ok: false,
      fieldErrors: Object.keys(fieldErrors).length
        ? fieldErrors
        : { message: "Something was wrong with that message. Try again." },
    };
  }

  // One line, so the sender's name can't pass for the message that follows it.
  const name = parsed.data.name.replace(/\s+/g, " ").trim();
  const email = parsed.data.email.trim();
  const message = parsed.data.message.trim();
  const kind = parsed.data.kind as ContactKind;

  const fieldErrors: Partial<Record<ContactField, string>> = {};
  if (!name) fieldErrors.name = "Enter your name.";
  if (!email) fieldErrors.email = "Enter the email we should reply to.";
  else if (!z.email().safeParse(email).success) {
    fieldErrors.email = "Enter an email like name@example.com.";
  }
  if (!KINDS.includes(kind)) fieldErrors.kind = TOO_LONG.kind;
  if (!message) fieldErrors.message = "Write your message.";

  return Object.keys(fieldErrors).length
    ? { ok: false, fieldErrors }
    : { ok: true, data: { name, email, kind, message } };
}

const SENDER_PREFIX = "From: ";

/** How a message is kept in the request's notes: the sender's name, then the message. */
export function contactNotes(name: string, message: string): string {
  return `${SENDER_PREFIX}${name}\n\n${message}`;
}

/** The sender's name from notes written by contactNotes, or null for any other notes. */
export function senderNameFromNotes(notes: string | null): string | null {
  if (!notes?.startsWith(SENDER_PREFIX)) return null;
  const end = notes.indexOf("\n");
  const name = notes.slice(SENDER_PREFIX.length, end === -1 ? undefined : end).trim();
  return name || null;
}

export function contactTopicLabel(kind: string): string {
  return CONTACT_TOPICS.find((topic) => topic.kind === kind)?.label ?? kind.toLowerCase();
}

/**
 * A reply in the privacy team's own mail app, addressed to the sender, with
 * their message quoted. Plain mailto: no mail service is involved in Pulse.
 */
export function replyMailto(email: string, notes: string | null): string {
  const quoted = (notes ?? "")
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")
    .slice(0, 1500);
  const subject = "Your message to the AIESEC Pulse privacy team";
  const body = quoted ? `\n\n${quoted}` : "";
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
