"use client";

import Link from "@tiptap/extension-link";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold as BoldIcon,
  Code as CodeIcon,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic as ItalicIcon,
  Link2,
  List,
  ListOrdered,
  Loader2,
  type LucideIcon,
  Quote,
  Strikethrough,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { InsertImageDialog } from "@/components/editor/InsertImageDialog";
import { PulseImageNode } from "@/components/editor/PulseImageNode";
import { isSafeHref, type PulseDocument, sanitiseDocument } from "@/lib/content/document";

// The extension list is the enforcement point for §10.1's rule: "the toolbar
// must never offer something the sanitiser will silently strip on save."
// Every node/mark lib/content/document.ts doesn't allowlist is switched off
// here rather than merely left off the toolbar, so a keyboard shortcut or a
// paste can't smuggle it in either.
function editorExtensions() {
  return [
    StarterKit.configure({
      link: false, // registered separately below, under our own href policy
      underline: false, // not in ALLOWED_MARKS
      codeBlock: false, // not in ALLOWED_BLOCKS — inline `code` mark stays on
      horizontalRule: false, // not in ALLOWED_BLOCKS
      hardBreak: false, // no soft-break node in the document model
      heading: { levels: [2, 3, 4] }, // h1 belongs to the post title
    }),
    Link.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: true,
      protocols: ["http", "https"],
      defaultProtocol: "https",
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      isAllowedUri: (url) => isSafeHref(url),
    }),
    PulseImageNode,
  ];
}

// Mirrors the cover-image field's own rule set exactly (components/PostComposer.tsx)
// — one signed-upload endpoint, one policy, enforced wherever an author attaches
// an image.
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type RichTextEditorProps = {
  id?: string;
  content: PulseDocument;
  onChange: (doc: PulseDocument) => void;
  /** Behind `posts.rich_text` — a kill switch for the authoring surface, not the storage format. */
  showToolbar: boolean;
  placeholder?: string;
  disabled?: boolean;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
};

export function RichTextEditor({
  id,
  content,
  onChange,
  showToolbar,
  placeholder = "Share what's happening in your entity…",
  disabled = false,
  ariaDescribedBy,
  ariaInvalid,
}: RichTextEditorProps) {
  const editor = useEditor({
    // Deferred to after mount: TipTap's own SSR/hydration guidance for
    // Next.js — creating the editor during the server render produces a
    // markup mismatch, since ProseMirror needs a real DOM.
    immediatelyRender: false,
    editable: !disabled,
    content,
    extensions: editorExtensions(),
    onUpdate: ({ editor }) => onChange(sanitiseDocument(editor.getJSON())),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Content",
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
        ...(ariaInvalid ? { "aria-invalid": "true" } : {}),
        class: "pulse-editor-prose",
      },
    },
  });

  const { isEmpty } = useEditorState({
    editor,
    selector: ({ editor }) => ({ isEmpty: editor?.isEmpty ?? true }),
  }) ?? { isEmpty: true };

  // useEditor only reads `editable` at construction; a live disabled toggle
  // (submitting the form) needs to reach the already-created instance.
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div
        aria-hidden
        className="min-h-[150px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)]"
      />
    );
  }

  return (
    <div
      className={[
        "overflow-hidden rounded-[var(--radius-sm)] border bg-[var(--card)] transition-shadow",
        "focus-within:ring-2 focus-within:ring-[var(--primary)]/40",
        ariaInvalid ? "border-[var(--destructive)]" : "border-[var(--border)]",
      ].join(" ")}
    >
      {showToolbar && <Toolbar editor={editor} disabled={disabled} />}
      <div className="relative">
        {isEmpty && (
          <p
            aria-hidden
            className="pointer-events-none absolute left-4 top-3 text-[18px] text-[color:var(--muted-foreground)]"
          >
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      link: editor.isActive("link"),
      linkDisabled: editor.state.selection.empty && !editor.isActive("link"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      h4: editor.isActive("heading", { level: 4 }),
      blockquote: editor.isActive("blockquote"),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
    }),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ publicUrl: string } | null>(null);

  function toggleLink() {
    if (state.link) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const url = window.prompt("Link URL")?.trim();
    if (!url) return;
    if (!isSafeHref(url)) {
      window.alert("Links must start with http:// or https://");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  async function handleImageSelected(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      window.alert("Only JPEG, PNG, and WEBP images are allowed.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert("Image must be 5 MB or smaller.");
      return;
    }

    setIsUploading(true);
    try {
      const signRes = await fetch("/api/storage/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      });
      if (!signRes.ok) {
        const err = (await signRes.json()) as { error?: string };
        throw new Error(err.error ?? "Could not start upload.");
      }
      const { uploadUrl, publicUrl } = (await signRes.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload to storage failed. Please try again.");

      // mediaId is a placeholder here — the storage URL itself. It becomes a
      // real Media row (and a real id) at submit time, in
      // materializeInlineImages (app/actions/posts.ts); sanitiseDocument
      // treats mediaId as opaque either way (lib/content/document.ts).
      setPendingImage({ publicUrl });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function confirmImageInsert(alt: string) {
    if (!pendingImage) return;
    editor
      .chain()
      .focus()
      .insertPulseImage({ mediaId: pendingImage.publicUrl, alt, src: pendingImage.publicUrl })
      .run();
    setPendingImage(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-2 py-1.5">
      <ToolbarButton
        label="Bold"
        icon={BoldIcon}
        active={state.bold}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Italic"
        icon={ItalicIcon}
        active={state.italic}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="Strikethrough"
        icon={Strikethrough}
        active={state.strike}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolbarButton
        label="Code"
        icon={CodeIcon}
        active={state.code}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolbarButton
        label={state.link ? "Remove link" : "Add link"}
        icon={Link2}
        active={state.link}
        disabled={disabled || (state.linkDisabled && !state.link)}
        onClick={toggleLink}
      />

      <Divider />

      <ToolbarButton
        label="Heading 2"
        icon={Heading2}
        active={state.h2}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="Heading 3"
        icon={Heading3}
        active={state.h3}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <ToolbarButton
        label="Heading 4"
        icon={Heading4}
        active={state.h4}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
      />

      <Divider />

      <ToolbarButton
        label="Quote"
        icon={Quote}
        active={state.blockquote}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="Bullet list"
        icon={List}
        active={state.bulletList}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="Numbered list"
        icon={ListOrdered}
        active={state.orderedList}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />

      <Divider />

      <ToolbarButton
        label={isUploading ? "Uploading image…" : "Insert image"}
        icon={isUploading ? Loader2 : ImagePlus}
        spinning={isUploading}
        disabled={disabled || isUploading}
        onClick={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImageSelected(file);
        }}
      />
      <InsertImageDialog
        key={pendingImage?.publicUrl ?? "closed"}
        open={pendingImage !== null}
        previewUrl={pendingImage?.publicUrl ?? null}
        onCancel={() => setPendingImage(null)}
        onConfirm={confirmImageInsert}
      />
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px bg-[var(--border)]" />;
}

function ToolbarButton({
  label,
  icon: Icon,
  active,
  disabled = false,
  spinning = false,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  /** Omitted (not `false`) for action buttons like "Insert image" that aren't a toggle — aria-pressed shouldn't be announced on those at all. */
  active?: boolean;
  disabled?: boolean;
  spinning?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={[
        "flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
        disabled
          ? "cursor-not-allowed text-[color:var(--muted-foreground)] opacity-40"
          : active
            ? "bg-[var(--primary)]/10 text-[color:var(--primary-text)]"
            : "text-[color:var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[color:var(--foreground)]",
      ].join(" ")}
    >
      <Icon
        size={16}
        strokeWidth={2}
        className={spinning ? "animate-spin pulse-ambient" : undefined}
        aria-hidden
      />
    </button>
  );
}
