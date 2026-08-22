// The node allowlist is a security boundary: bodies are rendered from
// structured JSON with no raw HTML ingestion, so a document arriving from a
// client is untrusted input like any other.

export type TextNode = {
  type: "text";
  text: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

export type BlockNode =
  | { type: "paragraph"; content?: TextNode[] }
  | { type: "heading"; attrs?: { level?: number }; content?: TextNode[] }
  | { type: "blockquote"; content?: BlockNode[] }
  | { type: "bulletList"; content?: BlockNode[] }
  | { type: "orderedList"; content?: BlockNode[] }
  | { type: "listItem"; content?: BlockNode[] }
  | { type: "image"; attrs: { mediaId: string; alt: string } };

export type PulseDocument = { type: "doc"; content: BlockNode[] };

const ALLOWED_BLOCKS = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "image",
]);

const ALLOWED_MARKS = new Set(["bold", "italic", "strike", "code", "link"]);

// Block types whose `content` is itself BlockNode[] — as opposed to
// paragraph/heading, whose `content` is inline TextNode[]. Shared by every
// caller that walks the document's block structure (sanitiseBlock here,
// collectImageMediaIds below, materializeInlineImages in app/actions/posts.ts)
// so a text run is never misread as a nested block.
export const CONTAINER_BLOCK_TYPES = new Set([
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
]);

export const EMPTY_DOCUMENT: PulseDocument = { type: "doc", content: [] };

// The mediaIds a post-detail (or any other read surface) needs to resolve
// into URLs before handing the document to DocumentRenderer — an image block
// with an unresolved mediaId renders as nothing (see DocumentRenderer.tsx).
export function collectImageMediaIds(doc: PulseDocument): string[] {
  const ids: string[] = [];

  function walk(node: BlockNode) {
    if (node.type === "image") {
      ids.push(node.attrs.mediaId);
      return;
    }
    if (CONTAINER_BLOCK_TYPES.has(node.type) && "content" in node && Array.isArray(node.content)) {
      (node.content as BlockNode[]).forEach(walk);
    }
  }

  doc.content.forEach(walk);
  return ids;
}

export function documentFromPlainText(text: string): PulseDocument {
  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map<BlockNode>((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    }));

  return { type: "doc", content: paragraphs };
}

// Blocks separated by a blank line so search snippets and digest excerpts break
// at sensible boundaries.
export function plainTextFromDocument(doc: unknown): string {
  const parsed = sanitiseDocument(doc);
  return parsed.content.map(blockToText).filter(Boolean).join("\n\n");
}

function blockToText(node: BlockNode): string {
  if (node.type === "image") return node.attrs.alt;
  if ("content" in node && Array.isArray(node.content)) {
    const children = node.content as Array<BlockNode | TextNode>;
    return children
      .map((child) =>
        "type" in child && child.type === "text" ? child.text : blockToText(child as BlockNode)
      )
      .join(node.type === "bulletList" || node.type === "orderedList" ? "\n" : "");
  }
  return "";
}

type Mark = NonNullable<TextNode["marks"]>[number];

function sanitiseMarks(marks: unknown): TextNode["marks"] {
  if (!Array.isArray(marks)) return undefined;

  const kept: Mark[] = [];
  for (const candidate of marks) {
    if (!candidate || typeof candidate !== "object") continue;
    const mark = candidate as { type?: unknown; attrs?: Record<string, unknown> };
    if (typeof mark.type !== "string" || !ALLOWED_MARKS.has(mark.type)) continue;

    if (mark.type !== "link") {
      kept.push({ type: mark.type });
      continue;
    }

    // Anything that is not http(s) is dropped entirely rather than kept with a
    // neutered href — a link that silently goes nowhere is more confusing.
    const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
    if (isSafeHref(href)) kept.push({ type: "link", attrs: { href } });
  }

  return kept.length > 0 ? kept : undefined;
}

export function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitiseInline(nodes: unknown): TextNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((n): n is { type: string; text?: unknown; marks?: unknown } =>
      Boolean(n && typeof n === "object" && (n as { type?: unknown }).type === "text")
    )
    .map((n) => ({
      type: "text" as const,
      text: typeof n.text === "string" ? n.text : "",
      marks: sanitiseMarks(n.marks),
    }))
    .filter((n) => n.text.length > 0);
}

function sanitiseBlock(node: unknown): BlockNode | null {
  if (!node || typeof node !== "object") return null;
  const candidate = node as { type?: unknown; attrs?: unknown; content?: unknown };
  if (typeof candidate.type !== "string" || !ALLOWED_BLOCKS.has(candidate.type)) return null;

  switch (candidate.type) {
    case "heading": {
      const raw = (candidate.attrs as { level?: unknown } | undefined)?.level;
      // h1 belongs to the post title; body headings start at h2.
      const level = typeof raw === "number" && raw >= 2 && raw <= 4 ? raw : 2;
      return { type: "heading", attrs: { level }, content: sanitiseInline(candidate.content) };
    }
    case "paragraph":
      return { type: "paragraph", content: sanitiseInline(candidate.content) };
    case "image": {
      // The id is kept opaque here — whether it names a real Media row is
      // resolved at render time, not during sanitisation. Alt text is
      // mandatory, same rule the cover-image field already enforces, so a
      // block that omits it is dropped rather than kept without one.
      const attrs = candidate.attrs as { mediaId?: unknown; alt?: unknown } | undefined;
      const mediaId = typeof attrs?.mediaId === "string" ? attrs.mediaId.trim() : "";
      const alt = typeof attrs?.alt === "string" ? attrs.alt.trim() : "";
      if (!mediaId || !alt) return null;
      return { type: "image", attrs: { mediaId, alt } };
    }
    case "blockquote":
    case "bulletList":
    case "orderedList":
    case "listItem": {
      const children = Array.isArray(candidate.content)
        ? candidate.content.map(sanitiseBlock).filter((n): n is BlockNode => n !== null)
        : [];
      return { type: candidate.type, content: children } as BlockNode;
    }
    default:
      return null;
  }
}

export function sanitiseDocument(input: unknown): PulseDocument {
  if (!input || typeof input !== "object") return EMPTY_DOCUMENT;
  const candidate = input as { type?: unknown; content?: unknown };
  if (candidate.type !== "doc" || !Array.isArray(candidate.content)) return EMPTY_DOCUMENT;

  return {
    type: "doc",
    content: candidate.content.map(sanitiseBlock).filter((n): n is BlockNode => n !== null),
  };
}

export type DocumentSection = { id: string; label: string };

/**
 * Top-level level-2 headings, in document order, as a flat "on this page"
 * index. Ids are positional (`section-0`, `section-1`, …) rather than
 * slugified from the heading text — no collision handling, no unicode edge
 * cases needed — and DocumentRenderer stamps the identical rule
 * independently on its own render pass, so the two stay in sync by
 * construction rather than by cross-checking against each other.
 */
export function extractSections(doc: PulseDocument): DocumentSection[] {
  const sections: DocumentSection[] = [];
  let index = 0;
  for (const node of doc.content) {
    if (node.type !== "heading" || (node.attrs?.level ?? 2) !== 2) continue;
    const label = (node.content ?? [])
      .map((t) => t.text)
      .join("")
      .trim();
    const id = `section-${index}`;
    index += 1;
    if (label) sections.push({ id, label });
  }
  return sections;
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function excerptFrom(text: string, maxLength = 200): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLength) return flat;
  const cut = flat.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// Shared by every path that materialises an uploaded image into a Media row
// (createPost, resubmitPost, saveDraft) — the signed-upload flow never learns
// a real content-type, so this is the one place that guesses one back from
// the storage URL's extension.
export function guessMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}
