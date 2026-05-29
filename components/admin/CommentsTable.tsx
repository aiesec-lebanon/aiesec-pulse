"use client";

import { useState } from "react";
import Link from "next/link";
import { DeleteCommentModal } from "./DeleteCommentModal";

export type CommentRow = {
  id: string;
  content: string;
  tombstone: boolean;
  createdAt: string;
  authorName: string;
  authorEntity: string | null;
  postId: string;
  postTitle: string;
};

interface CommentsTableProps {
  rows: CommentRow[];
}

export function CommentsTable({ rows }: CommentsTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-col gap-2" role="list" aria-label="Comments">
        {rows.map((row) => (
          <article
            key={row.id}
            role="listitem"
            className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] px-5 py-3.5 flex items-start gap-4"
          >
            {/* Tombstone badge */}
            {row.tombstone && (
              <span className="mt-0.5 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-[4px] text-[12px] font-medium bg-[var(--muted)] text-[var(--muted-foreground)]">
                Removed
              </span>
            )}

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[var(--muted-foreground)] mb-1 truncate">
                <span className="font-medium text-[var(--foreground)]">
                  {row.authorName}
                </span>
                {row.authorEntity && <> · {row.authorEntity}</>}
                {" · "}
                <Link
                  href={`/admin/posts/${row.postId}`}
                  className="hover:text-[var(--primary)] transition-colors"
                >
                  {row.postTitle}
                </Link>
                {" · "}
                {row.createdAt}
              </p>
              <p
                className={[
                  "text-[15px] leading-[1.5] line-clamp-2",
                  row.tombstone
                    ? "italic text-[var(--muted-foreground)]"
                    : "text-[var(--foreground)]",
                ].join(" ")}
              >
                {row.content}
              </p>
            </div>

            {/* Remove action — only for live comments */}
            {!row.tombstone && (
              <button
                type="button"
                onClick={() => setDeleteTarget(row.id)}
                className="flex-shrink-0 mt-0.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[13px] font-medium text-[var(--muted-foreground)] hover:border-[var(--destructive)] hover:text-[var(--destructive)] transition-colors cursor-pointer"
                aria-label={`Remove comment by ${row.authorName}`}
              >
                Remove
              </button>
            )}
          </article>
        ))}
      </div>

      <DeleteCommentModal
        commentId={deleteTarget ?? ""}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
