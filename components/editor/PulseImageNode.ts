import { mergeAttributes, Node } from "@tiptap/core";

// Mirrors lib/content/document.ts's image block exactly: mediaId + required
// alt, nothing else survives sanitiseDocument. `src` is a third, editor-only
// attribute — it never appears in the document model's type and is dropped
// the moment sanitiseDocument() runs the node through its allowlist, but it's
// what lets a freshly-inserted image preview before the post is ever saved
// (mediaId is still just the storage URL at that point; see
// materializeInlineImages in app/actions/posts.ts for how it becomes a real
// Media id on submit).
export type PulseImageAttrs = { mediaId: string; alt: string; src?: string | null };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pulseImage: {
      insertPulseImage: (attrs: PulseImageAttrs) => ReturnType;
    };
  }
}

export const PulseImageNode = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      mediaId: { default: null },
      alt: { default: "" },
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-media-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { "data-media-id": HTMLAttributes.mediaId })];
  },

  addNodeView() {
    return ({ node }) => {
      const mediaId = typeof node.attrs.mediaId === "string" ? node.attrs.mediaId : "";
      const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
      const src = typeof node.attrs.src === "string" ? node.attrs.src : null;

      const dom = document.createElement(src ? "img" : "div");
      dom.setAttribute("data-media-id", mediaId);
      if (src) {
        dom.setAttribute("src", src);
        dom.setAttribute("alt", alt);
        dom.className = "pulse-editor-image";
      } else {
        // No preview URL to render — a mediaId that already names a real
        // Media row (e.g. resuming a rejected post's saved content) rather
        // than a fresh upload. Shown as a labelled placeholder rather than a
        // broken <img>, so the author knows the block is there without a
        // media lookup existing on the editing surface (that's a render-time
        // concern DocumentRenderer's MediaLookup already owns).
        dom.className = "pulse-editor-image-placeholder";
        dom.textContent = alt || "Image";
      }
      return { dom };
    };
  },

  addCommands() {
    return {
      insertPulseImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
