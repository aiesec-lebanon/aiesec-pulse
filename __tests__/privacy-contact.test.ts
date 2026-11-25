import { describe, expect, it } from "vitest";

import {
  CONTACT_LIMITS,
  contactNotes,
  contactTopicLabel,
  replyMailto,
  senderNameFromNotes,
  validateContact,
} from "@/lib/privacy/contact";

const VALID = {
  name: "Rana Haddad",
  email: "rana@example.com",
  kind: "QUESTION",
  message: "Which of my data does Pulse hold?",
};

describe("validateContact", () => {
  it("accepts a complete message and trims it", () => {
    const result = validateContact({ ...VALID, email: "  rana@example.com ", message: " Hi \n" });
    expect(result).toEqual({
      ok: true,
      data: { ...VALID, message: "Hi" },
    });
  });

  it("asks for every field, so the team can reply", () => {
    const result = validateContact({ name: " ", email: "", kind: "QUESTION", message: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(["email", "message", "name"]);
  });

  it("refuses an address that cannot be replied to", () => {
    const result = validateContact({ ...VALID, email: "not-an-address" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.email).toMatch(/name@example\.com/);
  });

  it("only accepts the listed topics", () => {
    const result = validateContact({ ...VALID, kind: "DELETE_EVERYTHING" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.kind).toBeDefined();
  });

  it("caps every field", () => {
    const result = validateContact({
      ...VALID,
      message: "x".repeat(CONTACT_LIMITS.message + 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.message).toMatch(/4000/);
  });

  it("keeps the sender's name on one line", () => {
    const result = validateContact({ ...VALID, name: "Rana\n\nFrom: someone else" });
    expect(result.ok && result.data.name).toBe("Rana From: someone else");
  });

  it("treats missing input as empty, not as a crash", () => {
    expect(validateContact(null).ok).toBe(false);
    expect(validateContact({ name: 1 }).ok).toBe(false);
  });
});

describe("message notes", () => {
  it("round-trips the sender's name", () => {
    const notes = contactNotes("Rana Haddad", "Line one\nLine two");
    expect(notes).toBe("From: Rana Haddad\n\nLine one\nLine two");
    expect(senderNameFromNotes(notes)).toBe("Rana Haddad");
  });

  it("finds no sender in notes written another way", () => {
    expect(senderNameFromNotes("Erasure executed with content election: remove.")).toBeNull();
    expect(senderNameFromNotes(null)).toBeNull();
  });

  it("labels each topic for the queue", () => {
    expect(contactTopicLabel("QUESTION")).toBe("A question or a complaint");
    expect(contactTopicLabel("SOMETHING_ELSE")).toBe("something_else");
  });
});

describe("replyMailto", () => {
  it("addresses the sender and quotes their message without a mail service", () => {
    const url = replyMailto("rana@example.com", "From: Rana\n\nHello & thanks?");
    expect(url.startsWith("mailto:rana@example.com?subject=")).toBe(true);
    const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
    expect(params.get("subject")).toBe("Your message to the AIESEC Pulse privacy team");
    expect(params.get("body")).toBe("\n\n> From: Rana\n> \n> Hello & thanks?");
  });
});
