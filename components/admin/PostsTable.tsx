"use client";

import Link from "next/link";
import { useState } from "react";

import { hidePost, restorePost } from "@/app/actions/posts";
import { PostStatus } from "@/app/generated/prisma/enums";

import { HideContentModal } from "./HideContentModal";

export type PostRow = {
  id: string;
  slug: string;
  title: string;
  status: PostStatus;
  authorName: string;
  authorEntity: string;
  createdAt: string;
  reactionCount: number;
  commentCount: number;
  hiddenReason: string | null;
};

const STATUS_PILL: Record<PostStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-[var(--muted)] text-[var(--muted-foreground)]" },
  IN_REVIEW: {
    label: "In review",
    className:
      "bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] text-[var(--destructive-text)]",
  },
  SCHEDULED: {
    label: "Scheduled",
    className: "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary-text)]",
  },
  PUBLISHED: {
    label: "Published",
    className: "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success-text)]",
  },
  REJECTED: {
    label: "Rejected",
    className:
      "bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] text-[var(--destructive-text)]",
  },
  ARCHIVED: { label: "Archived", className: "bg-[var(--muted)] text-[var(--muted-foreground)]" },
  HIDDEN: { label: "Hidden", className: "bg-[var(--muted)] text-[var(--muted-foreground)]" },
};

export function PostsTable({ rows }: { rows: PostRow[] }) {
  const [hideTarget, setHideTarget] = useState<{ id: string; title: string } | null>(null);

  return (
    <>
      <div className="flex flex-col gap-2" role="list" aria-label="Posts">
        {rows.map((row) => {
          const pill = STATUS_PILL[row.status];
          return (
            <article
              key={row.id}
              role="listitem"
              className="aiesec-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`shrink-0 rounded-[var(--radius-md)] px-2 py-0.5 text-[12px] font-medium ${pill.className}`}
                  >
                    {pill.label}
                  </span>
                  {row.status === PostStatus.PUBLISHED ? (
                    <Link
                      href={`/posts/${row.slug}`}
                      className="truncate text-[15px] font-bold text-[var(--foreground)] hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                    >
                      {row.title}
                    </Link>
                  ) : (
                    <span className="truncate text-[15px] font-bold text-[var(--foreground)]">
                      {row.title}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[13px] text-[var(--muted-foreground)]">
                  {row.authorName} · {row.authorEntity} ·{" "}
                  <time dateTime={row.createdAt}>
                    {new Date(row.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>{" "}
                  · {row.reactionCount} reactions · {row.commentCount} comments
                </p>
                {row.hiddenReason && (
                  <p className="mt-1 text-[13px] text-[var(--destructive-text)]">
                    Hidden: {row.hiddenReason}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {row.status === PostStatus.HIDDEN ? (
                  <form action={async () => restorePost(row.id).then(() => undefined)}>
                    <button
                      type="submit"
                      className="min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[14px] font-bold text-[var(--muted-foreground)] transition-colors hover:border-[var(--success)] hover:text-[var(--success-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                    >
                      Restore<span className="sr-only"> {row.title}</span>
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setHideTarget({ id: row.id, title: row.title })}
                    className="min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[14px] font-bold text-[var(--muted-foreground)] transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    Hide<span className="sr-only"> {row.title}</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <HideContentModal
        key={hideTarget?.id ?? "closed"}
        open={hideTarget !== null}
        title="Hide this post?"
        description="It disappears from the feed immediately. The author is shown your reason and can appeal. Nothing is deleted."
        targetLabel={hideTarget?.title ?? ""}
        onClose={() => setHideTarget(null)}
        onConfirm={async (reason) => hidePost(hideTarget!.id, reason)}
      />
    </>
  );
}
