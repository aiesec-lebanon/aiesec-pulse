import { describe, expect, it } from "vitest";

import { safeReturnTo } from "@/lib/auth/oauth";
import {
  documentFromPlainText,
  excerptFrom,
  isSafeHref,
  plainTextFromDocument,
  readingMinutes,
  sanitiseDocument,
} from "@/lib/content/document";
import { slugifyTitle } from "@/lib/content/slug";
import { quotaPeriodFor } from "@/lib/quota";
import { termEndsAt, termLabelFor } from "@/lib/term";
import { currentIsoWeek, isoWeekShortLabel, lastNIsoWeeks } from "@/lib/week";

describe("quota periods", () => {
  it("labels ISO weeks so historical quotaPeriod values still line up", () => {
    // 2026-05-24 is a Sunday — ISO week 21, not 22. Off-by-one here would hand
    // every publisher a second allowance on a Sunday.
    expect(currentIsoWeek(new Date("2026-05-24T12:00:00Z"))).toBe("2026-W21");
    expect(currentIsoWeek(new Date("2026-05-25T00:00:00Z"))).toBe("2026-W22");
  });

  it("keeps a Monday and the following Sunday in the same window", () => {
    const monday = currentIsoWeek(new Date("2026-08-10T00:00:00Z"));
    const sunday = currentIsoWeek(new Date("2026-08-16T23:59:59Z"));
    expect(monday).toBe(sunday);
  });

  it("handles the year boundary, where the ISO week belongs to the other year", () => {
    // 1 Jan 2027 is a Friday, so it sits in the last ISO week of 2026.
    expect(currentIsoWeek(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
  });

  it("produces distinct labels for weeks and months", () => {
    const at = new Date("2026-08-14T00:00:00Z");
    expect(quotaPeriodFor("ISO_WEEK", at)).toBe("2026-W33");
    expect(quotaPeriodFor("CALENDAR_MONTH", at)).toBe("2026-M08");
  });

  it("returns the requested number of consecutive weeks, oldest first", () => {
    const weeks = lastNIsoWeeks(8, new Date("2026-08-14T00:00:00Z"));
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toBe("2026-W33");
    expect(new Set(weeks).size).toBe(8);
  });

  it("labels a week for humans", () => {
    expect(isoWeekShortLabel("2026-W21")).toMatch(/^May W\d$/);
    expect(isoWeekShortLabel("nonsense")).toBe("nonsense");
  });
});

describe("AIESEC terms", () => {
  it("rolls at the July boundary", () => {
    expect(termLabelFor(new Date("2026-06-30T23:59:59Z"))).toBe("25.26");
    expect(termLabelFor(new Date("2026-07-01T00:00:00Z"))).toBe("26.27");
  });

  it("pads single-digit years", () => {
    expect(termLabelFor(new Date("2030-08-01T00:00:00Z"))).toBe("30.31");
    expect(termLabelFor(new Date("2009-08-01T00:00:00Z"))).toBe("09.10");
  });

  it("derives a term's end instant so grants expire without manual work", () => {
    expect(termEndsAt("26.27")?.toISOString()).toBe("2027-07-01T00:00:00.000Z");
    expect(termEndsAt("garbage")).toBeNull();
  });
});

describe("post documents", () => {
  it("round-trips plain text through the document shape", () => {
    const text = "First paragraph.\n\nSecond paragraph.";
    const doc = documentFromPlainText(text);
    expect(doc.content).toHaveLength(2);
    expect(plainTextFromDocument(doc)).toBe("First paragraph.\n\nSecond paragraph.");
  });

  it("drops blank lines rather than emitting empty paragraphs", () => {
    expect(documentFromPlainText("a\n\n\n\nb").content).toHaveLength(2);
  });

  it("handles an empty body", () => {
    expect(documentFromPlainText("").content).toEqual([]);
    expect(plainTextFromDocument({ type: "doc", content: [] })).toBe("");
  });
});

describe("document sanitisation", () => {
  it("drops node types outside the allowlist", () => {
    const doc = sanitiseDocument({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "kept" }] },
        { type: "script", content: [{ type: "text", text: "dropped" }] },
        { type: "iframe", attrs: { src: "https://evil.example" } },
      ],
    });
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe("paragraph");
  });

  it("drops a javascript: link mark entirely", () => {
    const doc = sanitiseDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "click me",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    });
    const marks = (doc.content[0] as { content?: Array<{ marks?: unknown[] }> }).content?.[0].marks;
    expect(marks).toBeUndefined();
  });

  it("keeps an http(s) link mark", () => {
    const doc = sanitiseDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "aiesec",
              marks: [{ type: "link", attrs: { href: "https://aiesec.org" } }],
            },
          ],
        },
      ],
    });
    const marks = (doc.content[0] as { content?: Array<{ marks?: Array<{ type: string }> }> })
      .content?.[0].marks;
    expect(marks?.[0].type).toBe("link");
  });

  it("drops unknown inline marks", () => {
    const doc = sanitiseDocument({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "onclick" }] }] },
      ],
    });
    const marks = (doc.content[0] as { content?: Array<{ marks?: unknown[] }> }).content?.[0].marks;
    expect(marks).toBeUndefined();
  });

  it("clamps heading levels so the page keeps one h1", () => {
    const doc = sanitiseDocument({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "h" }] }],
    });
    expect((doc.content[0] as { attrs?: { level?: number } }).attrs?.level).toBe(2);
  });

  it("returns an empty document for junk input", () => {
    expect(sanitiseDocument(null).content).toEqual([]);
    expect(sanitiseDocument("<script>alert(1)</script>").content).toEqual([]);
    expect(sanitiseDocument({ type: "notdoc" }).content).toEqual([]);
  });
});

describe("isSafeHref", () => {
  it("accepts http and https only", () => {
    expect(isSafeHref("https://aiesec.org")).toBe(true);
    expect(isSafeHref("http://aiesec.org")).toBe(true);
  });

  it("rejects executable and data schemes", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeHref("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHref("not a url")).toBe(false);
  });
});

describe("reading time and excerpts", () => {
  it("floors at one minute", () => {
    expect(readingMinutes("short")).toBe(1);
    expect(readingMinutes("")).toBe(1);
  });

  it("scales at roughly 200 words per minute", () => {
    expect(readingMinutes(Array(400).fill("word").join(" "))).toBe(2);
    expect(readingMinutes(Array(1000).fill("word").join(" "))).toBe(5);
  });

  it("cuts excerpts on a word boundary", () => {
    const excerpt = excerptFrom("The quick brown fox jumps over the lazy dog", 20);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(21);
    expect(excerpt).not.toMatch(/\s…$/);
  });

  it("leaves short text alone", () => {
    expect(excerptFrom("Short.", 200)).toBe("Short.");
  });
});

describe("slugify", () => {
  it("produces a URL-safe slug", () => {
    expect(slugifyTitle("Lebanon oGV results — Q3!")).toBe("lebanon-ogv-results-q3");
  });

  it("strips diacritics and never ends in a hyphen", () => {
    expect(slugifyTitle("Café résumé —")).toBe("cafe-resume");
  });

  it("falls back for a title with no usable characters", () => {
    expect(slugifyTitle("!!!")).toBe("post");
  });
});

/**
 * `returnTo` is attacker-influenced input on an unauthenticated endpoint. An
 * open redirect off the sign-in flow is a credible phishing primitive:
 * "aiesec-pulse.org signed me in and then sent me here".
 */
describe("safeReturnTo", () => {
  it("allows internal paths", () => {
    expect(safeReturnTo("/feed")).toBe("/feed");
    expect(safeReturnTo("/posts/some-slug?x=1")).toBe("/posts/some-slug?x=1");
  });

  it("rejects absolute URLs", () => {
    expect(safeReturnTo("https://evil.example/steal")).toBe("/feed");
  });

  it("rejects protocol-relative URLs, which browsers treat as absolute", () => {
    expect(safeReturnTo("//evil.example/steal")).toBe("/feed");
  });

  it("rejects backslash-prefixed paths some parsers normalise to //", () => {
    expect(safeReturnTo("/\\evil.example")).toBe("/feed");
  });

  it("refuses to bounce back into the auth machinery", () => {
    expect(safeReturnTo("/api/auth/start")).toBe("/feed");
  });

  it("defaults for empty input", () => {
    expect(safeReturnTo(null)).toBe("/feed");
    expect(safeReturnTo(undefined)).toBe("/feed");
    expect(safeReturnTo("")).toBe("/feed");
  });
});
