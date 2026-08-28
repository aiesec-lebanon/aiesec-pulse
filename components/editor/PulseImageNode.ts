import { mergeAttributes, Node } from "@tiptap/core";

// mediaId + alt mirror the document model's image block; sanitiseDocument
// strips everything else, including editor-only `src`, a preview URL until
// submit swaps mediaId for a real Media id (materializeInlineImages).
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
        // No src means mediaId already points to a real Media row (e.g. a
        // resumed rejected post), not a fresh upload — show a placeholder
        // rather than resolving it here; DocumentRenderer's MediaLookup
        // owns that.
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
