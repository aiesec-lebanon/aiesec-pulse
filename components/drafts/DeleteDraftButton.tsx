"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteDraft } from "@/app/actions/drafts";

export function DeleteDraftButton({ postId, title }: { postId: string; title: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Delete "${title || "this draft"}"? This can't be undone.`)) return;
    setIsDeleting(true);
    setError(null);

    const result = await deleteDraft(postId);
    if (result.ok) {
      router.refresh();
      return; // isDeleting stays true — the row disappears on refresh
    }
    setError(result.error);
    setIsDeleting(false);
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={isDeleting}
        aria-label={title ? `Delete draft: ${title}` : "Delete draft"}
        className="flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-[13px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--destructive-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={14} strokeWidth={2} aria-hidden />
        {isDeleting ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <p role="alert" className="text-[12px] text-[var(--destructive-text)]">
          {error}
        </p>
      )}
    </div>
  );
}
