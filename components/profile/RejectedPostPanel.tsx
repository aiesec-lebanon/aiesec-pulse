"use client";

import { ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { resubmitPost } from "@/app/actions/posts";
import { createPostSchema } from "@/lib/zod-schemas";

type Props = {
  post: {
    id: string;
    title: string;
    content: string;
    linkUrl: string | null;
    mediaUrl: string | null;
    mediaAlt: string | null;
    rejectionReason: string | null;
  };
};

type FieldErrors = Partial<Record<"title" | "content" | "linkUrl", string>>;

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function RejectedPostPanel({ post }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [linkUrl, setLinkUrl] = useState(post.linkUrl ?? "");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const linkDomain = extractDomain(linkUrl);
  const linkIsValid = linkUrl.length > 0 && linkDomain.length > 0;
  const linkIsInvalid = linkUrl.length > 0 && !linkIsValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const validated = createPostSchema.safeParse({
      title,
      content,
      linkUrl: linkUrl || "",
      mediaUrl: post.mediaUrl ?? "",
      mediaAlt: post.mediaAlt ?? undefined,
    });
    if (!validated.success) {
      const errors: FieldErrors = {};
      for (const issue of validated.error.issues) {
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
      const result = await resubmitPost(post.id, {
        title,
        content,
        linkUrl: linkUrl || "",
        mediaUrl: post.mediaUrl ?? "",
        mediaAlt: post.mediaAlt ?? undefined,
      });
      if (result.ok) {
        setSuccessMsg(
          result.status === "PUBLISHED"
            ? "Your post is live in the feed."
            : "Your post has been resubmitted for review."
        );
        router.refresh();
        return;
      }
      const newFieldErrors: FieldErrors = {};
      let formError: string | null = null;
      for (const [key, msg] of Object.entries(result.errors)) {
        if (key === "title") newFieldErrors.title = msg;
        else if (key === "content") newFieldErrors.content = msg;
        else if (key === "linkUrl") newFieldErrors.linkUrl = msg;
        else formError = msg;
      }
      setFieldErrors(newFieldErrors);
      if (formError) setServerError(formError);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  if (successMsg) {
    return (
      <div className="mt-2 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--success)_10%,var(--card))] border border-[var(--success)]/30 px-4 py-3 text-[14px] text-[var(--success-text)]">
        {successMsg}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--destructive-text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        aria-expanded={open}
      >
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        {open ? "Close review" : "Review & edit"}
      </button>

      {open && (
        <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5">
          {/* Rejection reason */}
          {post.rejectionReason && (
            <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--destructive)]/30 bg-[color-mix(in_srgb,var(--destructive)_8%,var(--card))] px-4 py-3">
              <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--destructive-text)] opacity-80">
                Moderator&apos;s reason
              </p>
              <p className="mt-1 text-[14px] leading-[1.5] text-[var(--foreground)]">
                {post.rejectionReason}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {/* Title */}
            <div>
              <label
                htmlFor={`edit-title-${post.id}`}
                className="mb-1 block text-[13px] font-medium text-[var(--foreground)]"
              >
                Title{" "}
                <span aria-hidden className="text-[var(--destructive-text)]">
                  *
                </span>
              </label>
              <input
                id={`edit-title-${post.id}`}
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={[
                  "h-10 w-full rounded-[var(--radius-sm)] border bg-[var(--muted)] px-3 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40",
                  fieldErrors.title ? "border-[var(--destructive)]" : "border-[var(--border)]",
                ].join(" ")}
              />
              {fieldErrors.title && (
                <p role="alert" className="mt-1 text-[12px] text-[var(--destructive-text)]">
                  {fieldErrors.title}
                </p>
              )}
            </div>

            {/* Content */}
            <div>
              <label
                htmlFor={`edit-content-${post.id}`}
                className="mb-1 block text-[13px] font-medium text-[var(--foreground)]"
              >
                Content{" "}
                <span aria-hidden className="text-[var(--destructive-text)]">
                  *
                </span>
              </label>
              <textarea
                id={`edit-content-${post.id}`}
                required
                rows={5}
                maxLength={10000}
                value={content}
                onChange={handleContentChange}
                style={{ resize: "none", overflow: "hidden" }}
                className={[
                  "w-full min-h-[120px] rounded-[var(--radius-sm)] border bg-[var(--muted)] px-3 py-2 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40",
                  fieldErrors.content ? "border-[var(--destructive)]" : "border-[var(--border)]",
                ].join(" ")}
              />
              {fieldErrors.content && (
                <p role="alert" className="mt-1 text-[12px] text-[var(--destructive-text)]">
                  {fieldErrors.content}
                </p>
              )}
            </div>

            {/* Link URL */}
            <div>
              <label
                htmlFor={`edit-link-${post.id}`}
                className="mb-1 block text-[13px] font-medium text-[var(--foreground)]"
              >
                External link{" "}
                <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
              </label>
              <input
                id={`edit-link-${post.id}`}
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                className={[
                  "h-10 w-full rounded-[var(--radius-sm)] border bg-[var(--muted)] px-3 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40",
                  linkIsInvalid ? "border-[var(--destructive)]" : "border-[var(--border)]",
                ].join(" ")}
              />
              {linkIsInvalid && (
                <p role="alert" className="mt-1 text-[12px] text-[var(--destructive-text)]">
                  Please enter a valid URL including https://.
                </p>
              )}
              {linkIsValid && (
                <div className="mt-1 flex items-center gap-1 text-[12px] text-[var(--muted-foreground)]">
                  <ExternalLink size={11} strokeWidth={2} aria-hidden />
                  <span>{linkDomain}</span>
                </div>
              )}
            </div>

            {serverError && (
              <div
                role="alert"
                className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] px-4 py-3 text-[13px] text-[var(--destructive-text)]"
              >
                {serverError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--primary)] px-5 py-2 text-[14px] font-bold text-[var(--primary-foreground)] shadow-[0px_2px_0px_0px_rgba(5,145,255,0.1)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && (
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" aria-hidden />
                )}
                {isSubmitting ? "Resubmitting…" : "Resubmit post"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-5 py-2 text-[14px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
