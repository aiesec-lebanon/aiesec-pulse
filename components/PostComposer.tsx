"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, ExternalLink, Loader2, X } from "lucide-react";
import { createPost, type CreatePostResult } from "@/app/actions/posts";
import { createPostSchema } from "@/lib/zod-schemas";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

type FieldErrors = Partial<Record<"title" | "content" | "linkUrl" | "image", string>>;

export function PostComposer() {
  const router = useRouter();

  // Form fields
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // Image state — upload happens eagerly on file select
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [titleFocused, setTitleFocused] = useState(false);
  const [contentFocused, setContentFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const hasContent =
    title.trim().length > 0 ||
    content.trim().length > 0 ||
    linkUrl.trim().length > 0 ||
    imagePreview !== null;

  // --- Image helpers ---

  function clearImage() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setImagePreview(null);
    setUploadedMediaUrl(null);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileSelected(file: File) {
    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        image: "Only JPEG, PNG, and WEBP images are allowed.",
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({
        ...prev,
        image: "Image must be 5 MB or smaller.",
      }));
      return;
    }

    // Clear any previous image error and show immediate object-URL preview
    setFieldErrors((prev) => { const { image: _omit, ...rest } = prev; return rest; });
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setImagePreview(objectUrl);
    setUploadedMediaUrl(null);
    setIsUploading(true);

    try {
      // Step 1: get a signed upload URL from our Route Handler
      const signRes = await fetch("/api/storage/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      if (!signRes.ok) {
        const err = (await signRes.json()) as { error?: string };
        throw new Error(err.error ?? "Could not start upload.");
      }
      const { uploadUrl, publicUrl } = (await signRes.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };

      // Step 2: PUT directly to Supabase (bypasses Next.js body limits)
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload to storage failed. Please try again.");

      // Success — store the public URL for the form submission
      setUploadedMediaUrl(publicUrl);
    } catch (err) {
      clearImage();
      setFieldErrors((prev) => ({
        ...prev,
        image: err instanceof Error ? err.message : "Image upload failed.",
      }));
    } finally {
      setIsUploading(false);
    }
  }

  // --- Textarea auto-grow ---

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  // --- Drag-and-drop ---

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFileSelected(file);
  }

  // --- Cancel ---

  function handleCancel() {
    if (hasContent && !window.confirm("Discard your update?")) return;
    router.back();
  }

  // --- Submit ---

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || isUploading) return;

    // Client-side validation
    const validationResult = createPostSchema.safeParse({
      title,
      content,
      linkUrl: linkUrl || "",
      mediaUrl: uploadedMediaUrl || "",
    });
    if (!validationResult.success) {
      const errors: FieldErrors = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0];
        if (field === "title" || field === "content" || field === "linkUrl") {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setServerError(null);
    setIsSubmitting(true);

    try {
      const result: CreatePostResult = await createPost({
        title,
        content,
        linkUrl: linkUrl || "",
        mediaUrl: uploadedMediaUrl || "",
      });

      if (result.ok) {
        if (result.status === "PUBLISHED") {
          router.push(`/posts/${result.postId}`);
        } else {
          router.push("/posts/queued");
        }
        return; // isSubmitting stays true — loading shows until navigation lands
      }

      // Map server field errors back to client state
      const newFieldErrors: FieldErrors = {};
      let formError: string | null = null;
      for (const [key, msg] of Object.entries(result.errors)) {
        if (key === "title") newFieldErrors.title = msg;
        else if (key === "content") newFieldErrors.content = msg;
        else if (key === "linkUrl") newFieldErrors.linkUrl = msg;
        else formError = msg; // _form or unexpected key
      }
      setFieldErrors(newFieldErrors);
      if (formError) setServerError(formError);
      setIsSubmitting(false);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setIsSubmitting(false);
    }
  }

  // --- Derived values ---

  const linkDomain = extractDomain(linkUrl);
  const linkIsValid = linkUrl.length > 0 && linkDomain.length > 0;
  const linkIsInvalid = linkUrl.length > 0 && !linkIsValid;
  const submitBlocked = isSubmitting || isUploading;

  // --- Render ---

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">

      {/* ── Title ── */}
      <div>
        <label
          htmlFor="title"
          className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
        >
          Title{" "}
          <span aria-hidden className="text-[var(--destructive)]">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          autoComplete="off"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          placeholder="What's the update about?"
          aria-describedby={fieldErrors.title ? "title-error" : undefined}
          className={[
            "h-11 w-full rounded-[var(--radius-sm)] border bg-[var(--card)] px-3 text-[16px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40",
            fieldErrors.title ? "border-[var(--destructive)]" : "border-[var(--border)]",
          ].join(" ")}
        />
        <div className="mt-1 flex items-start justify-between gap-2">
          {fieldErrors.title ? (
            <p id="title-error" role="alert" className="text-[13px] text-[var(--destructive)]">
              {fieldErrors.title}
            </p>
          ) : <span />}
          {titleFocused && (
            <span className="shrink-0 text-[12px] text-[var(--muted-foreground)]">
              {title.length}/200
            </span>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div>
        <label
          htmlFor="content"
          className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
        >
          Content{" "}
          <span aria-hidden className="text-[var(--destructive)]">*</span>
        </label>
        <textarea
          id="content"
          name="content"
          required
          rows={6}
          maxLength={10000}
          value={content}
          onChange={handleContentChange}
          onFocus={() => setContentFocused(true)}
          onBlur={() => setContentFocused(false)}
          placeholder="Share what's happening in your entity…"
          aria-describedby={fieldErrors.content ? "content-error" : undefined}
          style={{ resize: "none", overflow: "hidden" }}
          className={[
            "w-full min-h-[150px] rounded-[var(--radius-sm)] border bg-[var(--card)] px-3 py-2.5 text-[16px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40",
            fieldErrors.content ? "border-[var(--destructive)]" : "border-[var(--border)]",
          ].join(" ")}
        />
        <div className="mt-1 flex items-start justify-between gap-2">
          {fieldErrors.content ? (
            <p id="content-error" role="alert" className="text-[13px] text-[var(--destructive)]">
              {fieldErrors.content}
            </p>
          ) : <span />}
          {contentFocused && (
            <span className="shrink-0 text-[12px] text-[var(--muted-foreground)]">
              {content.length}/10,000
            </span>
          )}
        </div>
      </div>

      {/* ── Image ── */}
      <div>
        <p className="mb-1.5 text-[14px] font-medium text-[var(--foreground)]">
          Image{" "}
          <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
        </p>

        {imagePreview ? (
          <div className="relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Selected image preview"
              className="max-h-64 w-full object-cover"
            />
            {/* Uploading overlay */}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--card)]/60 backdrop-blur-[2px]">
                <Loader2
                  size={28}
                  strokeWidth={2}
                  className="animate-spin text-[var(--primary)]"
                  aria-label="Uploading image…"
                />
              </div>
            )}
            {/* Remove button — only shown once upload is done */}
            {!isUploading && (
              <button
                type="button"
                onClick={clearImage}
                aria-label="Remove image"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--foreground)]/70 text-white transition-colors hover:bg-[var(--foreground)]"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload image"
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={[
              "flex cursor-pointer select-none flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
              isDragging
                ? "border-[var(--primary)] bg-[var(--primary)]/5"
                : "border-[var(--border)] hover:border-[var(--primary)]/60",
            ].join(" ")}
          >
            <ImageIcon
              size={32}
              strokeWidth={1.5}
              className="text-[var(--muted-foreground)]"
              aria-hidden
            />
            <p className="text-[15px] text-[var(--muted-foreground)]">
              Drop an image here or{" "}
              <span className="font-medium text-[var(--primary)]">click to browse</span>
            </p>
            <p className="text-[13px] text-[var(--muted-foreground)]">
              PNG, JPG, WEBP up to 5 MB
            </p>
          </div>
        )}

        {fieldErrors.image && (
          <p role="alert" className="mt-1 text-[13px] text-[var(--destructive)]">
            {fieldErrors.image}
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        />
      </div>

      {/* ── External link ── */}
      <div>
        <label
          htmlFor="linkUrl"
          className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
        >
          External link{" "}
          <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
        </label>
        <input
          id="linkUrl"
          name="linkUrl"
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://…"
          aria-describedby={linkIsInvalid ? "link-error" : undefined}
          className={[
            "h-11 w-full rounded-[var(--radius-sm)] border bg-[var(--card)] px-3 text-[16px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40",
            linkIsInvalid ? "border-[var(--destructive)]" : "border-[var(--border)]",
          ].join(" ")}
        />
        {linkIsInvalid && (
          <p id="link-error" role="alert" className="mt-1 text-[13px] text-[var(--destructive)]">
            Please enter a valid URL including https://.
          </p>
        )}
        {linkIsValid && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)]">
            <ExternalLink size={12} strokeWidth={2} aria-hidden />
            <span>{linkDomain}</span>
          </div>
        )}
      </div>

      {/* ── Server error ── */}
      {serverError && (
        <div
          role="alert"
          className="rounded-[var(--radius-md)] bg-[var(--destructive)]/10 px-4 py-3 text-[14px] text-[var(--destructive)]"
        >
          {serverError}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitBlocked}
          aria-disabled={submitBlocked}
          className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--primary)] px-6 py-3 text-[16px] font-bold text-[var(--primary-foreground)] shadow-[0px_2px_0px_0px_rgba(5,145,255,0.1)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {(isSubmitting || isUploading) && (
            <Loader2 size={16} strokeWidth={2} className="animate-spin" aria-hidden />
          )}
          {isUploading ? "Uploading…" : isSubmitting ? "Posting…" : "Post update"}
        </button>

        <button
          type="button"
          onClick={handleCancel}
          disabled={submitBlocked}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-6 py-3 text-[16px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
