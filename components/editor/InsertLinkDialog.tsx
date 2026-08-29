"use client";

import { useEffect, useRef, useState } from "react";

import { isSafeHref } from "@/lib/content/document";

// Mirrors InsertImageDialog's shape (single required field, focus trap,
// Escape-to-close) for the toolbar's other text-prompt call site — the
// `window.prompt`/`window.alert` pair it replaces had no focus management at
// all and broke the visual register on the composer's flagship surface.
export function InsertLinkDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (_url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input"
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  function confirm() {
    const trimmed = url.trim();
    if (trimmed.length === 0) {
      setError("Enter a URL.");
      return;
    }
    if (!isSafeHref(trimmed)) {
      setError("Links must start with http:// or https://.");
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="insert-link-title"
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6"
      >
        <h2 id="insert-link-title" className="text-[18px] font-bold text-[color:var(--foreground)]">
          Add a link
        </h2>

        {/* A <form> here would nest inside the composer's outer <form> —
            invalid HTML that silently corrupts its submission.
            Enter-to-confirm and the buttons are wired by hand instead. */}
        <div className="mt-4">
          <label
            htmlFor="insert-link-url"
            className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
          >
            URL{" "}
            <span aria-hidden className="text-[color:var(--destructive-text)]">
              *
            </span>
          </label>
          <input
            id="insert-link-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
            placeholder="https://…"
            aria-describedby={error ? "insert-link-url-error" : undefined}
            aria-invalid={error ? true : undefined}
            className={[
              "w-full rounded-[var(--radius-md)] border bg-[var(--card)] px-3 py-2 text-[15px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none",
              error ? "border-[var(--destructive)]" : "border-[var(--border)]",
            ].join(" ")}
          />
          {error && (
            <p
              id="insert-link-url-error"
              role="alert"
              className="mt-1 text-[13px] text-[color:var(--destructive-text)]"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              className="min-h-[36px] rounded-[var(--radius-sm)] bg-[var(--primary-fill)] px-4 py-2 text-[14px] font-bold text-[color:var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Add link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
