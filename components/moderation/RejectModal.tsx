"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { rejectPost } from "@/app/actions/posts";

interface RejectModalProps {
  postId: string;
  open: boolean;
  onClose: () => void;
}

export function RejectModal({ postId, open, onClose }: RejectModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
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

  // Keyed on `open`, so each opening is a fresh mount with empty state.
  if (!open) return null;

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= 5 && trimmed.length <= 500;

  const handleSubmit = () => {
    if (!canSubmit) {
      setError("Reason must be between 5 and 500 characters.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await rejectPost(postId, trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        className="relative bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md p-6 flex flex-col gap-5 shadow-lg"
      >
        <h2
          id="reject-modal-title"
          className="text-[20px] font-bold leading-tight text-[color:var(--foreground)]"
        >
          Reject this post?
        </h2>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="reject-reason"
            className="text-[14px] font-medium text-[color:var(--muted-foreground)]"
          >
            Reason{" "}
            <span className="font-normal">(visible to other moderators in the audit log)</span>
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError("");
            }}
            rows={4}
            maxLength={500}
            placeholder="Describe why this post is being rejected…"
            disabled={isPending}
            className="w-full border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--background)] text-[color:var(--foreground)] text-[16px] leading-[1.6] p-3 resize-none focus:outline-none focus:border-[var(--primary)] disabled:opacity-50 transition-colors"
          />
          <div className="flex justify-between items-start text-[12px]">
            <span className="text-[color:var(--destructive-text)]" role="alert" aria-live="polite">
              {error}
            </span>
            <span className="text-[color:var(--muted-foreground)] tabular-nums flex-shrink-0 pl-2">
              {reason.length}/500
            </span>
          </div>
        </div>

        <p className="text-[14px] text-[color:var(--muted-foreground)] leading-[1.6]">
          This post will be discarded. The MCP will not be notified. Please follow up offline if
          needed.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="border border-[var(--border)] text-[color:var(--foreground)] rounded-[var(--radius-sm)] px-5 py-[9px] text-[16px] font-medium hover:border-[var(--primary)] hover:text-[color:var(--primary-text)] disabled:opacity-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !canSubmit}
            className="bg-[var(--destructive-text)] text-white rounded-[var(--radius-sm)] px-5 py-[9px] text-[16px] font-bold disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {isPending ? "Rejecting…" : "Reject post"}
          </button>
        </div>
      </div>
    </div>
  );
}
