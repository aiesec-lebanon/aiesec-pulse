"use client";

import { useEffect, useRef, useState, useTransition } from "react";

export function HideContentModal({
  open,
  title,
  description,
  targetLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  targetLabel: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), textarea, a[href]"
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
  }, [open, onClose]);

  // Keyed by the caller, so opening for a different target remounts with empty
  // state. Clearing in an effect would cost a render on every close.
  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError("Record a reason of at least 5 characters — the author will see it.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onConfirm(trimmed);
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hide-modal-title"
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6"
      >
        <h2 id="hide-modal-title" className="text-[18px] font-bold text-[color:var(--foreground)]">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.5] text-[color:var(--muted-foreground)]">
          {description}
        </p>
        <p className="mt-3 truncate rounded-[var(--radius-md)] bg-[var(--muted)] px-3 py-2 text-[14px] font-medium text-[color:var(--foreground)]">
          {targetLabel}
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <label
            htmlFor="hide-reason"
            className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
          >
            Reason{" "}
            <span aria-hidden className="text-[color:var(--destructive-text)]">
              *
            </span>
          </label>
          <textarea
            id="hide-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            required
            aria-describedby={error ? "hide-reason-error" : undefined}
            aria-invalid={error ? true : undefined}
            className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[15px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
          />
          {error && (
            <p
              id="hide-reason-error"
              role="alert"
              className="mt-1 text-[13px] text-[color:var(--destructive-text)]"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-[36px] rounded-[var(--radius-sm)] bg-[var(--destructive-text)] px-4 py-2 text-[14px] font-bold text-white transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
            >
              {pending ? "Hiding…" : "Hide"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
