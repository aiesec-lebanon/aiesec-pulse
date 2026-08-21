"use client";

import { useEffect, useRef, useState } from "react";

// Same focus-trap / Escape-to-close / focus-return shape as ReasonModal
// (design system §9.4, §10.6) — the reference implementation, not RejectModal's.
// Like that component, state is never reset in an effect — the caller keys
// this by the pending upload so a new image gets a fresh instance instead.
export function InsertImageDialog({
  open,
  previewUrl,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  previewUrl: string | null;
  onCancel: () => void;
  onConfirm: (alt: string) => void;
}) {
  const [alt, setAlt] = useState("");
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
    const trimmed = alt.trim();
    if (trimmed.length === 0) {
      setError("Describe the image for people using a screen reader");
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
        aria-labelledby="insert-image-title"
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6"
      >
        <h2
          id="insert-image-title"
          className="text-[18px] font-bold text-[color:var(--foreground)]"
        >
          Describe this image
        </h2>

        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local upload preview, not a next/image-eligible remote asset
          <img
            src={previewUrl}
            alt=""
            className="mt-3 max-h-40 w-full rounded-[var(--radius-md)] object-cover"
          />
        )}

        {/* A <form> here would nest inside the composer's own outer <form> —
            invalid HTML that silently corrupts the outer form's submission.
            Enter-to-confirm and the buttons are wired by hand instead. */}
        <div className="mt-4">
          <label
            htmlFor="insert-image-alt"
            className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
          >
            Alt text{" "}
            <span aria-hidden className="text-[color:var(--destructive-text)]">
              *
            </span>
          </label>
          <input
            id="insert-image-alt"
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
            maxLength={300}
            required
            aria-describedby={error ? "insert-image-alt-error" : "insert-image-alt-hint"}
            aria-invalid={error ? true : undefined}
            placeholder="e.g. Delegates on stage at the closing plenary"
            className={[
              "w-full rounded-[var(--radius-md)] border bg-[var(--card)] px-3 py-2 text-[15px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none",
              error ? "border-[var(--destructive)]" : "border-[var(--border)]",
            ].join(" ")}
          />
          {error ? (
            <p
              id="insert-image-alt-error"
              role="alert"
              className="mt-1 text-[13px] text-[color:var(--destructive-text)]"
            >
              {error}
            </p>
          ) : (
            <p
              id="insert-image-alt-hint"
              className="mt-1 text-[13px] text-[color:var(--muted-foreground)]"
            >
              Read aloud to members using a screen reader. Say what the image shows, not that it is
              an image.
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
              Insert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
