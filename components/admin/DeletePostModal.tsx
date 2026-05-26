"use client";

import { useTransition } from "react";
import { deletePost } from "@/app/actions/posts";

interface DeletePostModalProps {
  postId: string;
  postTitle: string;
  open: boolean;
  onClose: () => void;
}

export function DeletePostModal({ postId, postTitle, open, onClose }: DeletePostModalProps) {
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  const handleDelete = () => {
    startTransition(async () => {
      await deletePost(postId);
      onClose();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-post-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md p-6 flex flex-col gap-5 shadow-lg">
        <h2
          id="delete-post-modal-title"
          className="text-[20px] font-bold leading-tight text-[var(--foreground)]"
        >
          Delete this post permanently?
        </h2>

        <p className="text-[15px] font-medium text-[var(--foreground)] truncate">
          &ldquo;{postTitle}&rdquo;
        </p>

        <p className="text-[14px] leading-[1.6] text-[var(--muted-foreground)]">
          This cascades to its comments and likes. This action cannot be undone.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="border border-[var(--border)] text-[var(--foreground)] rounded-[var(--radius-sm)] px-5 py-[9px] text-[16px] font-medium hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="bg-[var(--destructive)] text-white rounded-[var(--radius-sm)] px-5 py-[9px] text-[16px] font-bold disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {isPending ? "Deleting…" : "Delete post"}
          </button>
        </div>
      </div>
    </div>
  );
}
