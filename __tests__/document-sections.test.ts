import { describe, expect, it } from "vitest";

import { extractSections, type PulseDocument } from "@/lib/content/document";

// StoryHero/ReadingIndex and DocumentRenderer independently compute ids for
// the same document, so this id sequence must match exactly.

function heading(level: number, text: string): PulseDocument["content"][number] {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function paragraph(text: string): PulseDocument["content"][number] {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

describe("extractSections", () => {
  it("returns an empty list for a document with no headings", () => {
    const doc: PulseDocument = { type: "doc", content: [paragraph("Just a paragraph.")] };
    expect(extractSections(doc)).toEqual([]);
  });

  it("lists level-2 headings in document order with positional ids", () => {
    const doc: PulseDocument = {
      type: "doc",
      content: [
        paragraph("Intro."),
        heading(2, "What changed"),
        paragraph("Body."),
        heading(2, "The numbers"),
        heading(2, "What happens next"),
      ],
    };
    expect(extractSections(doc)).toEqual([
      { id: "section-0", label: "What changed" },
      { id: "section-1", label: "The numbers" },
      { id: "section-2", label: "What happens next" },
    ]);
  });

  it("ignores h3 and h4 — only h2 forms the page index", () => {
    const doc: PulseDocument = {
      type: "doc",
      content: [heading(2, "Section one"), heading(3, "A subsection"), heading(4, "Detail")],
    };
    expect(extractSections(doc)).toEqual([{ id: "section-0", label: "Section one" }]);
  });

  it("skips a heading with no text from the visible list, but its id slot is still spent", () => {
    // DocumentRenderer counts every h2 (even blank ones) toward the index,
    // so a blank heading still consumes an id slot.
    const doc: PulseDocument = {
      type: "doc",
      content: [heading(2, ""), heading(2, "Real heading")],
    };
    expect(extractSections(doc)).toEqual([{ id: "section-1", label: "Real heading" }]);
  });

  it("returns a single entry for a document with exactly one heading", () => {
    const doc: PulseDocument = { type: "doc", content: [heading(2, "Only section")] };
    expect(extractSections(doc)).toEqual([{ id: "section-0", label: "Only section" }]);
  });

  it("joins multiple text runs in one heading into a single label", () => {
    const doc: PulseDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [
            { type: "text", text: "Bold " },
            { type: "text", text: "and plain", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    expect(extractSections(doc)).toEqual([{ id: "section-0", label: "Bold and plain" }]);
  });
});
