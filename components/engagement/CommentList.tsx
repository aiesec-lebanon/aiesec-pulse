"use client";

import { useTransition, useRef } from "react";
import { loadMoreComments } from "@/app/actions/comments";
import { PostAvatar } from "@/components/posts/_shared";
import { relativeTime } from "@/lib/relative-time";
import type { CommentDto } from "@/types/comment";

type Props = {
  postId: string;
  comments: CommentDto[];
  allLoaded: boolean;
  onLoadMore: (more: CommentDto[]) => void;
};

export function CommentList({ postId, comments, allLoaded, onLoadMore }: Props) {
  const [loading, startLoad] = useTransition();
  const firstNewRef = useRef<HTMLLIElement | null>(null);

  function handleShowMore() {
    const oldest = comments[comments.length - 1];
    if (!oldest) return;

    startLoad(async () => {
      const more = await loadMoreComments(postId, oldest.createdAt);
      onLoadMore(more);
    });
  }

  if (comments.length === 0) {
    return (
      <p className="text-[15px] text-[var(--muted-foreground)]">
        No comments yet. Be the first!
      </p>
    );
  }

  return (
    <>
      <ol className="flex flex-col gap-6" aria-label="Comments">
        {comments.map((comment, i) =>
          comment.tombstone ? (
            <li key={comment.id} ref={i === 0 ? firstNewRef : undefined}>
              <p className="text-[15px] italic text-[var(--muted-foreground)]">
                [Comment removed by moderator]
              </p>
            </li>
          ) : (
            <li
              key={comment.id}
              ref={i === 0 ? firstNewRef : undefined}
              className="flex gap-3"
            >
              <div className="shrink-0 pt-0.5">
                <PostAvatar
                  fullName={comment.author!.fullName}
                  avatarUrl={null}
                  size="sm"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[14px] font-bold text-[var(--foreground)]">
                    {comment.author!.fullName}
                  </span>
                  {comment.author!.committeeName && (
                    <span className="text-[12px] text-[var(--muted-foreground)]">
                      {comment.author!.committeeName}
                    </span>
                  )}
                  <time
                    dateTime={comment.createdAt}
                    className="text-[12px] text-[var(--muted-foreground)]"
                  >
                    {relativeTime(new Date(comment.createdAt))}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-[1.6] text-[var(--foreground)]">
                  {comment.content}
                </p>
              </div>
            </li>
          ),
        )}
      </ol>

      {!allLoaded && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleShowMore}
            disabled={loading}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-6 py-2.5 text-[15px] font-bold text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40"
          >
            {loading ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </>
  );
}
