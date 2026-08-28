"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteDraft } from "@/app/actions/drafts";
import { ReasonModal } from "@/components/ui/ReasonModal";

export function DeleteDraftButton({ postId, title }: { postId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isDeleting}
        aria-label={title ? `Delete draft: ${title}` : "Delete draft"}
        className="flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-[13px] font-medium text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--destructive-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={14} strokeWidth={2} aria-hidden />
        {isDeleting ? "Deleting…" : "Delete"}
      </button>

      {/* The success path was announced only by the row silently disappearing
          once `router.refresh()` lands — nothing for a screen-reader user. */}
      {announcement && (
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      )}

      <ReasonModal
        key={open ? "open" : "closed"}
        open={open}
        requireReason={false}
        title="Delete this draft?"
        description={`"${title || "This draft"}" will be deleted. This can't be undone.`}
        targetLabel={title || "Untitled draft"}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          setIsDeleting(true);
          const result = await deleteDraft(postId);
          if (result.ok) {
            setAnnouncement(title ? `Draft "${title}" deleted.` : "Draft deleted.");
            router.refresh();
            return result; // isDeleting stays true — the row disappears on refresh
          }
          setIsDeleting(false);
          return result;
        }}
      />
    </div>
  );
}
