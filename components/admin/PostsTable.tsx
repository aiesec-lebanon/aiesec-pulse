"use client";

import Link from "next/link";
import { useState } from "react";

import { hidePost, restorePost } from "@/app/actions/posts";
import { PostStatus } from "@/app/generated/prisma/enums";
import { StatusPill } from "@/components/ui/StatusPill";

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

export function PostsTable({ rows }: { rows: PostRow[] }) {
  const [hideTarget, setHideTarget] = useState<{ id: string; title: string } | null>(null);

  return (
    <>
      <div className="flex flex-col gap-2" role="list" aria-label="Posts">
        {rows.map((row) => (
          <article
            key={row.id}
            role="listitem"
            className="aiesec-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={row.status} />
                {row.status === PostStatus.PUBLISHED ? (
                  <Link
                    href={`/posts/${row.slug}`}
                    className="truncate text-[15px] font-bold text-[color:var(--foreground)] hover:text-[color:var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    {row.title}
                  </Link>
                ) : (
                  <span className="truncate text-[15px] font-bold text-[color:var(--foreground)]">
                    {row.title}
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-[13px] text-[color:var(--muted-foreground)]">
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
                <p className="mt-1 text-[13px] text-[color:var(--destructive-text)]">
                  Hidden: {row.hiddenReason}
                </p>
              )}
            </div>

            <div className="flex shrink-0 gap-2">
              {row.status === PostStatus.HIDDEN ? (
                <form action={async () => restorePost(row.id).then(() => undefined)}>
                  <button
                    type="submit"
                    className="min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:border-[var(--success)] hover:text-[color:var(--success-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    Restore<span className="sr-only"> {row.title}</span>
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setHideTarget({ id: row.id, title: row.title })}
                  className="min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:border-[var(--destructive)] hover:text-[color:var(--destructive-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                >
                  Hide<span className="sr-only"> {row.title}</span>
                </button>
              )}
            </div>
          </article>
        ))}
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
