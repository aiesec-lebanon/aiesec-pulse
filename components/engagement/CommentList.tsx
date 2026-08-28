"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { loadMoreComments } from "@/app/actions/comments";
import { PostAvatar } from "@/components/posts/_shared";
import { EntityName } from "@/components/ui/EntityName";
import { MetaLine } from "@/components/ui/MetaLine";
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

  // Which comments were already on screen when this list first rendered.
  // Anything arriving later — the reader's own optimistic comment, or a
  // "Show more" page — is *new* and gets the arrival animation. Without the
  // distinction, either nothing animates, or the whole thread re-animates on
  // every row change.
  const [seen] = useState(() => new Set(comments.map((c) => c.id)));
  useEffect(() => {
    for (const comment of comments) seen.add(comment.id);
  }, [comments, seen]);

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
      <p className="text-[15px] text-[color:var(--muted-foreground)]">
        No comments yet. Be the first!
      </p>
    );
  }

  return (
    <>
      <ol className="flex flex-col gap-6" aria-label="Comments">
        {comments.map((comment, i) => {
          const arrivalClass = seen.has(comment.id) ? "" : "pulse-copy-in";
          return comment.tombstone ? (
            <li key={comment.id} ref={i === 0 ? firstNewRef : undefined} className={arrivalClass}>
              {/* Tombstone: the row keeps its place so the thread does not
                  reshuffle under a reader, and a reply never orphans. */}
              <p className="text-[15px] italic text-[color:var(--muted-foreground)]">
                {comment.hiddenReason
                  ? `Comment hidden by a moderator: ${comment.hiddenReason}`
                  : "Comment removed."}
              </p>
            </li>
          ) : (
            <li
              key={comment.id}
              ref={i === 0 ? firstNewRef : undefined}
              className={`flex gap-3 ${arrivalClass}`}
            >
              <div className="shrink-0 pt-0.5">
                <PostAvatar fullName={comment.author!.fullName} avatarUrl={null} size="md" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-[14px] font-bold text-[color:var(--foreground)]">
                    {comment.author!.fullName}
                  </span>
                  <MetaLine
                    items={[
                      comment.author!.entityName && (
                        <EntityName key="entity" name={comment.author!.entityName} />
                      ),
                      <time key="age" dateTime={comment.createdAt}>
                        {relativeTime(new Date(comment.createdAt))}
                      </time>,
                    ]}
                  />
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-[1.6] text-[color:var(--foreground)]">
                  {comment.body}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {!allLoaded && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleShowMore}
            disabled={loading}
            className="min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-6 py-2.5 text-[15px] font-bold text-[color:var(--muted-foreground)] transition-[color,border-color,transform] duration-[calc(var(--dur-micro)*var(--motion-scale))] hover:border-[var(--primary)] hover:text-[color:var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] active:scale-[0.98] disabled:opacity-40"
          >
            {loading ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </>
  );
}
