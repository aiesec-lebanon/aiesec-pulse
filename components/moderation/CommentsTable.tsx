"use client";

import Link from "next/link";
import { useState } from "react";

import { hideComment, restoreComment } from "@/app/actions/comments";
import { ReasonModal } from "@/components/ui/ReasonModal";

export type CommentRow = {
  id: string;
  body: string;
  status: "VISIBLE" | "HIDDEN" | "DELETED";
  hiddenReason: string | null;
  createdAt: string;
  authorName: string;
  authorEntity: string | null;
  postSlug: string;
  postTitle: string;
};

export function CommentsTable({ rows }: { rows: CommentRow[] }) {
  const [hideTarget, setHideTarget] = useState<{ id: string; excerpt: string } | null>(null);

  return (
    <>
      <div className="flex flex-col" role="list" aria-label="Comments">
        {rows.map((row) => (
          <article
            key={row.id}
            role="listitem"
            className="flex flex-col gap-3 border-b border-[var(--hairline)] py-5 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-[color:var(--muted-foreground)]">
                {row.authorName}
                {row.authorEntity ? ` · ${row.authorEntity}` : ""} ·{" "}
                <time dateTime={row.createdAt}>
                  {new Date(row.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </time>{" "}
                · on{" "}
                <Link
                  href={`/posts/${row.postSlug}`}
                  className="pulse-link rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                >
                  {row.postTitle}
                </Link>
              </p>

              {row.status === "DELETED" ? (
                <p className="mt-1.5 text-[15px] italic text-[color:var(--muted-foreground)]">
                  Deleted by its author.
                </p>
              ) : (
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-[1.5] text-[color:var(--foreground)]">
                  {row.body}
                </p>
              )}

              {row.status === "HIDDEN" && (
                <p className="mt-1.5 text-[13px] text-[color:var(--destructive-text)]">
                  Hidden{row.hiddenReason ? `: ${row.hiddenReason}` : ""}
                </p>
              )}
            </div>

            {row.status !== "DELETED" && (
              <div className="shrink-0">
                {row.status === "HIDDEN" ? (
                  <form action={async () => restoreComment(row.id).then(() => undefined)}>
                    <button
                      type="submit"
                      className="min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:border-[var(--success)] hover:text-[color:var(--success-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                    >
                      Restore
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setHideTarget({ id: row.id, excerpt: row.body.slice(0, 80) })}
                    className="min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:border-[var(--destructive)] hover:text-[color:var(--destructive-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    Hide
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>

      <ReasonModal
        key={hideTarget?.id ?? "closed"}
        open={hideTarget !== null}
        title="Hide this comment?"
        description="It becomes a tombstone in the thread so replies keep their place. The author is shown your reason and can appeal."
        targetLabel={hideTarget?.excerpt ?? ""}
        reasonLabel="Reason"
        reasonHint="Record a reason of at least 5 characters — the author will see it."
        confirmLabel="Hide"
        pendingLabel="Hiding…"
        onClose={() => setHideTarget(null)}
        onConfirm={async (reason) => hideComment(hideTarget!.id, reason)}
      />
    </>
  );
}
