"use client";

import { useState } from "react";
import { PostStatus } from "@/app/generated/prisma/enums";
import { DeletePostModal } from "./DeletePostModal";

export type PostRow = {
  id: string;
  title: string;
  status: PostStatus;
  authorName: string;
  authorEntity: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
};

interface PostsTableProps {
  rows: PostRow[];
}

const STATUS_PILL: Record<PostStatus, { label: string; className: string }> = {
  PUBLISHED: {
    label: "Published",
    className: "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
  },
  PENDING: {
    label: "Pending",
    className: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] text-[var(--destructive)]",
  },
};

export function PostsTable({ rows }: PostsTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  return (
    <>
      <div className="flex flex-col gap-2" role="list" aria-label="Posts">
        {rows.map((row) => {
          const pill = STATUS_PILL[row.status];
          return (
            <article
              key={row.id}
              role="listitem"
              className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] px-5 py-3.5 flex items-center gap-4"
            >
              {/* Status pill */}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[12px] font-medium flex-shrink-0 ${pill.className}`}
              >
                {pill.label}
              </span>

              {/* Title + meta — grows to fill space */}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[var(--foreground)] truncate leading-tight">
                  {row.title}
                </p>
                <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5 truncate">
                  {row.authorName}
                  {row.authorEntity && <> · {row.authorEntity}</>}
                  {" · "}
                  {row.createdAt}
                </p>
              </div>

              {/* Engagement counts — hidden on mobile */}
              <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-[13px] text-[var(--muted-foreground)] tabular-nums">
                <span>{row.likeCount} likes</span>
                <span>{row.commentCount} comments</span>
              </div>

              {/* Delete */}
              <button
                type="button"
                onClick={() => setDeleteTarget({ id: row.id, title: row.title })}
                className="flex-shrink-0 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[13px] font-medium text-[var(--muted-foreground)] hover:border-[var(--destructive)] hover:text-[var(--destructive)] transition-colors cursor-pointer"
                aria-label={`Delete post: ${row.title}`}
              >
                Delete
              </button>
            </article>
          );
        })}
      </div>

      <DeletePostModal
        postId={deleteTarget?.id ?? ""}
        postTitle={deleteTarget?.title ?? ""}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
