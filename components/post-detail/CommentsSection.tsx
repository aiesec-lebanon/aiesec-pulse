"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  addComment,
  loadMoreComments,
  type CommentWithUser,
} from "@/app/actions/comments";
import { relativeTime } from "@/lib/relative-time";
import { PostAvatar } from "@/components/posts/_shared";

type Props = {
  postId: string;
  totalCount: number;
  initialComments: CommentWithUser[];
  currentUserId: string;
  currentUserName: string;
};

const MAX_CHARS = 2000;

function toDate(val: Date | string): Date {
  return val instanceof Date ? val : new Date(val as string);
}

export function CommentsSection({
  postId,
  totalCount,
  initialComments,
  currentUserName,
}: Props) {
  const [comments, setComments] = useState<CommentWithUser[]>(initialComments);
  const [userAdded, setUserAdded] = useState(0);
  const [allLoaded, setAllLoaded] = useState(
    totalCount <= initialComments.length,
  );
  // Cursor tracks the last comment loaded via "Show more" (not user-added ones)
  const pagedCursorRef = useRef<string | null>(
    initialComments.length > 0
      ? initialComments[initialComments.length - 1].id
      : null,
  );

  const [content, setContent] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [loadingMore, startLoadMore] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitError(null);

    startSubmit(async () => {
      try {
        const comment = await addComment(postId, trimmed);
        setComments((prev) => [...prev, comment]);
        setUserAdded((c) => c + 1);
        setContent("");
      } catch {
        setSubmitError("Failed to post comment. Please try again.");
      }
    });
  }

  function handleShowMore() {
    if (!pagedCursorRef.current) return;
    const cursor = pagedCursorRef.current;

    startLoadMore(async () => {
      try {
        const more = await loadMoreComments(postId, cursor);
        if (more.length > 0) {
          setComments((prev) => {
            // Insert before any user-added comments (which have createdAt >= server comments)
            const serverCount = prev.length - userAdded;
            const head = prev.slice(0, serverCount);
            const tail = prev.slice(serverCount);
            return [...head, ...more, ...tail];
          });
          pagedCursorRef.current = more[more.length - 1].id;
        }
        if (more.length < 20) setAllLoaded(true);
      } catch {
        // Silent fail — user can retry
      }
    });
  }

  const totalDisplayed = totalCount + userAdded;
  const chars = content.length;

  return (
    <section id="comments" aria-labelledby="comments-heading">
      <h2
        id="comments-heading"
        className="mb-6 text-[20px] font-bold text-[var(--foreground)]"
      >
        Comments ({totalDisplayed})
      </h2>

      {/* Composer */}
      <div className="mb-8 flex gap-3">
        <div className="shrink-0 pt-1">
          <PostAvatar fullName={currentUserName} avatarUrl={null} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
            placeholder="Write a comment…"
            rows={2}
            maxLength={MAX_CHARS}
            aria-label="Comment text"
            className="w-full resize-none overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[15px] leading-[1.5] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none transition-colors"
          />
          <div className="mt-2 flex items-center justify-between gap-4">
            <span
              className={`text-[12px] tabular-nums ${
                chars > MAX_CHARS * 0.9
                  ? "text-[var(--destructive)]"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              {chars}/{MAX_CHARS}
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!content.trim() || submitting}
              className="rounded-[var(--radius-sm)] bg-[var(--primary)] px-5 py-2 text-[14px] font-bold text-[var(--primary-foreground)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Posting…" : "Post"}
            </button>
          </div>
          {submitError && (
            <p
              role="alert"
              className="mt-2 text-[13px] text-[var(--destructive)]"
            >
              {submitError}
            </p>
          )}
        </div>
      </div>

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-[15px] text-[var(--muted-foreground)]">
          No comments yet. Be the first!
        </p>
      ) : (
        <ol className="flex flex-col gap-6" aria-label="Comments">
          {comments.map((comment) =>
            comment.deletedAt ? (
              <li key={comment.id}>
                <p className="text-[15px] italic text-[var(--muted-foreground)]">
                  [Comment removed by moderator]
                </p>
              </li>
            ) : (
              <li key={comment.id} className="flex gap-3">
                <div className="shrink-0 pt-0.5">
                  <PostAvatar
                    fullName={comment.user.fullName}
                    avatarUrl={null}
                    size="sm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[14px] font-bold text-[var(--foreground)]">
                      {comment.user.fullName}
                    </span>
                    <time
                      dateTime={toDate(comment.createdAt).toISOString()}
                      className="text-[12px] text-[var(--muted-foreground)]"
                    >
                      {relativeTime(toDate(comment.createdAt))}
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
      )}

      {/* Show more */}
      {!allLoaded && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleShowMore}
            disabled={loadingMore}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-6 py-2.5 text-[15px] font-bold text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40"
          >
            {loadingMore ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </section>
  );
}
