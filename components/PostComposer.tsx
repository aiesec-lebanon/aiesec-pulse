"use client";

import { ExternalLink, ImageIcon, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { publishDraft, saveDraft } from "@/app/actions/drafts";
import { createPost } from "@/app/actions/posts";
import {
  AudiencePicker,
  type AudiencePickerOptions,
  DEFAULT_AUDIENCE_VALUE,
} from "@/components/composer/AudiencePicker";
import { TopicPicker } from "@/components/composer/TopicPicker";
import { type ComposerInitialValues, useComposerForm } from "@/components/composer/useComposerForm";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import type { TopicOption } from "@/lib/content/topics";
import { formatAsWallTime, timeZoneOffsetLabel, zonedWallTimeToUtc } from "@/lib/timezone";
import { createPostSchema } from "@/lib/zod-schemas";

type FieldErrors = Partial<
  Record<"title" | "bodyJson" | "linkUrl" | "mediaAlt" | "scheduledAt" | "audience", string>
>;

// architecture.md §8.1 — verbatim interval.
const AUTOSAVE_DELAY_MS = 5_000;
type SaveStatus = "idle" | "saving" | "saved" | "error";

export type PostComposerProps = {
  richTextEnabled?: boolean;
  schedulingEnabled?: boolean;
  /** The author's `User.timezone` — schedule times are entered in this zone, not the browser's. */
  timezone?: string;
  /** Absent (or the flag off) hides the picker entirely — every post keeps the old unconditional GLOBAL default. */
  audienceOptions?: AudiencePickerOptions;
  /** The 13 pre-seeded, active topics. Empty hides the picker — nothing to choose from. */
  topics?: TopicOption[];
  /** An already-saved DRAFT being resumed; absent when starting fresh. */
  postId?: string;
  initialValues?: ComposerInitialValues;
};

export function PostComposer({
  richTextEnabled = false,
  schedulingEnabled = false,
  timezone = "UTC",
  audienceOptions,
  topics = [],
  postId,
  initialValues,
}: PostComposerProps) {
  const router = useRouter();

  const {
    title,
    setTitle,
    bodyJson,
    setBodyJson,
    linkUrl,
    setLinkUrl,
    mediaAlt,
    setMediaAlt,
    imagePreview,
    uploadedMediaUrl,
    isUploading,
    imageError,
    fileInputRef,
    clearImage,
    handleFileSelected,
    bodyText,
    hasContent,
    linkDomain,
    linkIsValid,
    linkIsInvalid,
  } = useComposerForm(initialValues);

  const [titleFocused, setTitleFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Wall-clock digits in `timezone`, no zone suffix — never persisted by
  // autosave (architecture.md §8.2 treats scheduling as a submit-time input,
  // not draft state), so this always starts blank even when resuming a draft.
  const [scheduledAt, setScheduledAt] = useState("");
  const minScheduleValue = formatAsWallTime(new Date(), timezone);

  // Same submit-time-only treatment as scheduledAt — not persisted by
  // autosave. Meaningless when audienceOptions is "fixed" (nothing to
  // choose), so the default is only ever actually sent for an "open" picker.
  const [audienceValue, setAudienceValue] = useState(DEFAULT_AUDIENCE_VALUE);

  // Also submit-time-only, like scheduledAt/audienceValue — resuming a draft
  // starts with nothing selected rather than re-fetching what was chosen
  // last time, since topics were never part of what saveDraft persisted.
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);

  // Seeded from the postId prop when resuming an already-saved draft;
  // undefined otherwise until the first save (autosave or explicit) creates
  // the row. Every save after that updates one row in place.
  const [draftId, setDraftId] = useState<string | undefined>(postId);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const savingRef = useRef(false);

  async function runSave() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      const result = await saveDraft(
        {
          title,
          bodyJson,
          linkUrl: linkUrl || "",
          mediaUrl: uploadedMediaUrl || "",
          mediaAlt: mediaAlt || undefined,
        },
        draftId
      );
      if (result.ok) {
        setDraftId(result.postId);
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      savingRef.current = false;
    }
  }

  // Debounced: a burst of keystrokes restarts the timer rather than firing on
  // every one, so autosave reflects a pause in typing, not each character.
  useEffect(() => {
    if (!hasContent || isUploading) return;
    const timeout = setTimeout(() => void runSave(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, bodyJson, linkUrl, mediaAlt, uploadedMediaUrl]);

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

  function handleCancel() {
    // Once autosave has actually persisted something, there is nothing left
    // to "discard" — warning otherwise would just be wrong.
    if (draftId) {
      router.push("/drafts");
      return;
    }
    if (hasContent && !window.confirm("Discard your update?")) return;
    router.back();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || isUploading) return;

    // Converted client-side so "Monday 9am Beirut" means what the author
    // intended regardless of the browser's own zone (architecture.md §8.3);
    // an unparseable value still reaches the schema so its "invalid date"
    // message is the one shown, rather than throwing here.
    let scheduledAtIso: string | undefined;
    if (scheduledAt) {
      const utc = zonedWallTimeToUtc(scheduledAt, timezone);
      scheduledAtIso = Number.isNaN(utc.getTime()) ? "invalid" : utc.toISOString();
    }

    // Only sent when there's an actual picker to have chosen from — a
    // "fixed" or absent audienceOptions means the server forces the
    // publisher's own entity (or the old GLOBAL default) regardless.
    const audiencePayload =
      audienceOptions?.kind === "open"
        ? { scopeType: audienceValue.scopeType, entityId: audienceValue.entityId }
        : undefined;

    const validationResult = createPostSchema.safeParse({
      title,
      bodyJson,
      linkUrl: linkUrl || "",
      mediaUrl: uploadedMediaUrl || "",
      mediaAlt: mediaAlt || undefined,
      scheduledAt: scheduledAtIso,
      audience: audiencePayload,
      topicIds: selectedTopicIds,
    });
    if (!validationResult.success) {
      const errors: FieldErrors = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0];
        if (
          field === "title" ||
          field === "bodyJson" ||
          field === "linkUrl" ||
          field === "mediaAlt" ||
          field === "scheduledAt" ||
          field === "audience"
        ) {
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
      const publishInput = {
        title,
        bodyJson,
        linkUrl: linkUrl || "",
        mediaUrl: uploadedMediaUrl || "",
        mediaAlt: mediaAlt || undefined,
        scheduledAt: scheduledAtIso,
        audience: audiencePayload,
        topicIds: selectedTopicIds,
      };
      // A draft created by autosave (or being resumed) publishes in place;
      // otherwise this is a from-scratch submission with nothing saved yet.
      const result = draftId
        ? await publishDraft(draftId, publishInput)
        : await createPost(publishInput);

      if (result.ok) {
        if (result.status === "PUBLISHED") {
          router.push(`/posts/${result.slug}`);
        } else if (result.status === "SCHEDULED") {
          router.push("/posts/scheduled");
        } else {
          router.push("/posts/queued");
        }
        return; // isSubmitting stays true — loading shows until navigation lands
      }

      const newFieldErrors: FieldErrors = {};
      let formError: string | null = null;
      for (const [key, msg] of Object.entries(result.errors)) {
        if (key === "title") newFieldErrors.title = msg;
        else if (key === "bodyJson") newFieldErrors.bodyJson = msg;
        else if (key === "linkUrl") newFieldErrors.linkUrl = msg;
        else if (key === "mediaAlt") newFieldErrors.mediaAlt = msg;
        else if (key === "scheduledAt") newFieldErrors.scheduledAt = msg;
        else if (key === "audience") newFieldErrors.audience = msg;
        else formError = msg; // _form or unexpected key
      }
      setFieldErrors(newFieldErrors);
      if (formError) setServerError(formError);
      setIsSubmitting(false);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setIsSubmitting(false);
    }
  }

  const submitBlocked = isSubmitting || isUploading;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {/* ── Title ── */}
      <div>
        <label
          htmlFor="title"
          className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
        >
          Title{" "}
          <span aria-hidden className="text-[var(--destructive-text)]">
            *
          </span>
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
            <p id="title-error" role="alert" className="text-[13px] text-[var(--destructive-text)]">
              {fieldErrors.title}
            </p>
          ) : (
            <span />
          )}
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
          <span aria-hidden className="text-[var(--destructive-text)]">
            *
          </span>
        </label>
        <RichTextEditor
          id="content"
          content={bodyJson}
          onChange={setBodyJson}
          showToolbar={richTextEnabled}
          disabled={isSubmitting || isUploading}
          ariaDescribedBy={fieldErrors.bodyJson ? "content-error" : undefined}
          ariaInvalid={Boolean(fieldErrors.bodyJson)}
        />
        <div className="mt-1 flex items-start justify-between gap-2">
          {fieldErrors.bodyJson ? (
            <p
              id="content-error"
              role="alert"
              className="text-[13px] text-[var(--destructive-text)]"
            >
              {fieldErrors.bodyJson}
            </p>
          ) : (
            <span />
          )}
          <span className="shrink-0 text-[12px] text-[var(--muted-foreground)]">
            {bodyText.length.toLocaleString()}/50,000
          </span>
        </div>
      </div>

      {/* ── Image ── */}
      <div>
        <p className="mb-1.5 text-[14px] font-medium text-[var(--foreground)]">
          Image <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
        </p>

        {imagePreview ? (
          <div className="relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
            {/* A local object URL, not a remote asset — next/image cannot optimise
                it and would only add a proxy hop. The authored description lives in
                the alt-text field below; until it is written the preview is
                decorative rather than mislabelled. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt={mediaAlt || ""} className="max-h-64 w-full object-cover" />
            {/* Uploading overlay */}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--card)]/60 backdrop-blur-[2px]">
                <Loader2
                  size={28}
                  strokeWidth={2}
                  className="animate-spin text-[var(--primary-text)]"
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
              <span className="font-medium text-[var(--primary-text)]">click to browse</span>
            </p>
            <p className="text-[13px] text-[var(--muted-foreground)]">PNG, JPG, WEBP up to 5 MB</p>
          </div>
        )}

        {imagePreview && (
          <div className="mt-3">
            <label
              htmlFor="mediaAlt"
              className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
            >
              Describe the image{" "}
              <span aria-hidden className="text-[var(--destructive-text)]">
                *
              </span>
            </label>
            <input
              id="mediaAlt"
              name="mediaAlt"
              type="text"
              value={mediaAlt}
              onChange={(e) => setMediaAlt(e.target.value)}
              maxLength={300}
              required
              aria-describedby={fieldErrors.mediaAlt ? "mediaAlt-error" : "mediaAlt-hint"}
              aria-invalid={fieldErrors.mediaAlt ? true : undefined}
              placeholder="e.g. Delegates on stage at the closing plenary"
              className={[
                "w-full rounded-[var(--radius-md)] border bg-[var(--card)] px-4 py-2.5 text-[15px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none",
                fieldErrors.mediaAlt ? "border-[var(--destructive)]" : "border-[var(--border)]",
              ].join(" ")}
            />
            {fieldErrors.mediaAlt ? (
              <p
                id="mediaAlt-error"
                role="alert"
                className="mt-1 text-[13px] text-[var(--destructive-text)]"
              >
                {fieldErrors.mediaAlt}
              </p>
            ) : (
              <p id="mediaAlt-hint" className="mt-1 text-[13px] text-[var(--muted-foreground)]">
                Read aloud to members using a screen reader. Say what the image shows, not that it
                is an image.
              </p>
            )}
          </div>
        )}

        {imageError && (
          <p role="alert" className="mt-1 text-[13px] text-[var(--destructive-text)]">
            {imageError}
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
          <p
            id="link-error"
            role="alert"
            className="mt-1 text-[13px] text-[var(--destructive-text)]"
          >
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

      {/* ── Topics ── */}
      {topics.length > 0 && (
        <TopicPicker
          topics={topics}
          selectedIds={selectedTopicIds}
          onChange={setSelectedTopicIds}
          disabled={isSubmitting || isUploading}
        />
      )}

      {/* ── Schedule ── */}
      {schedulingEnabled && (
        <div>
          <label
            htmlFor="scheduledAt"
            className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
          >
            Schedule <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
          </label>
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            value={scheduledAt}
            min={minScheduleValue}
            onChange={(e) => setScheduledAt(e.target.value)}
            aria-describedby={fieldErrors.scheduledAt ? "scheduledAt-error" : "scheduledAt-hint"}
            aria-invalid={fieldErrors.scheduledAt ? true : undefined}
            className={[
              "h-11 w-full max-w-[280px] rounded-[var(--radius-sm)] border bg-[var(--card)] px-3 text-[16px] text-[var(--foreground)] transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40",
              fieldErrors.scheduledAt ? "border-[var(--destructive)]" : "border-[var(--border)]",
            ].join(" ")}
          />
          {fieldErrors.scheduledAt ? (
            <p
              id="scheduledAt-error"
              role="alert"
              className="mt-1 text-[13px] text-[var(--destructive-text)]"
            >
              {fieldErrors.scheduledAt}
            </p>
          ) : (
            <p id="scheduledAt-hint" className="mt-1 text-[13px] text-[var(--muted-foreground)]">
              Leave blank to publish immediately. Times use your profile timezone ({timezone},{" "}
              {timeZoneOffsetLabel(timezone)}).
            </p>
          )}
        </div>
      )}

      {/* ── Audience ── */}
      {audienceOptions && (
        <AudiencePicker
          options={audienceOptions}
          value={audienceValue}
          onChange={setAudienceValue}
          error={fieldErrors.audience}
          disabled={isSubmitting || isUploading}
        />
      )}

      {/* ── Server error ── */}
      {serverError && (
        <div
          role="alert"
          className="rounded-[var(--radius-md)] bg-[var(--destructive)]/10 px-4 py-3 text-[14px] text-[var(--destructive-text)]"
        >
          {serverError}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitBlocked}
          aria-disabled={submitBlocked}
          className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--primary-fill)] px-6 py-3 text-[16px] font-bold text-[var(--primary-foreground)] shadow-[0px_2px_0px_0px_rgba(5,145,255,0.1)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {(isSubmitting || isUploading) && (
            <Loader2 size={16} strokeWidth={2} className="animate-spin" aria-hidden />
          )}
          {isUploading
            ? "Uploading…"
            : isSubmitting
              ? scheduledAt
                ? "Scheduling…"
                : "Publishing…"
              : scheduledAt
                ? "Schedule"
                : "Publish"}
        </button>

        <button
          type="button"
          onClick={() => void runSave()}
          disabled={submitBlocked || saveStatus === "saving"}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-6 py-3 text-[16px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveStatus === "saving" ? "Saving…" : "Save draft"}
        </button>

        <button
          type="button"
          onClick={handleCancel}
          disabled={submitBlocked}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-6 py-3 text-[16px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>

        <span
          aria-live="polite"
          role="status"
          className="text-[13px] text-[var(--muted-foreground)]"
        >
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && "Couldn't save draft"}
        </span>
      </div>
    </form>
  );
}
