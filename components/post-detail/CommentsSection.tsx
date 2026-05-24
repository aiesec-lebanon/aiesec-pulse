"use client";

import { useState, useCallback } from "react";
import { CommentComposer } from "@/components/engagement/CommentComposer";
import { CommentList } from "@/components/engagement/CommentList";
import type { CommentDto } from "@/types/comment";

type Props = {
  postId: string;
  totalCount: number;
  initialComments: CommentDto[];
  currentUserName: string;
};

export function CommentsSection({
  postId,
  totalCount,
  initialComments,
  currentUserName,
}: Props) {
  // newest-first: index 0 = most recent
  const [comments, setComments] = useState<CommentDto[]>(initialComments);
  const [optimisticCount, setOptimisticCount] = useState(0);
  const [allLoaded, setAllLoaded] = useState(totalCount <= initialComments.length);

  const handleOptimisticAdd = useCallback((optimistic: CommentDto) => {
    setComments((prev) => [optimistic, ...prev]);
    setOptimisticCount((c) => c + 1);
  }, []);

  // Replace the temporary optimistic entry with the server-confirmed one
  const handleConfirm = useCallback((optimistic: CommentDto, confirmed: CommentDto) => {
    setComments((prev) =>
      prev.map((c) => (c.id === optimistic.id ? confirmed : c)),
    );
  }, []);

  // Remove failed optimistic entry (e.g. rate-limited)
  const handleRemove = useCallback((optimistic: CommentDto) => {
    setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
    setOptimisticCount((c) => c - 1);
  }, []);

  // Append older comments from "Show more" (they come in desc order, oldest of batch at end)
  const handleLoadMore = useCallback((more: CommentDto[]) => {
    setComments((prev) => [...prev, ...more]);
    if (more.length < 20) setAllLoaded(true);
  }, []);

  const displayedCount = totalCount + optimisticCount;

  return (
    <section id="comments" aria-labelledby="comments-heading">
      <h2
        id="comments-heading"
        className="mb-6 text-[20px] font-bold text-[var(--foreground)]"
      >
        Comments ({displayedCount})
      </h2>

      <CommentComposer
        postId={postId}
        currentUserName={currentUserName}
        onOptimisticAdd={handleOptimisticAdd}
        onConfirm={handleConfirm}
        onRemove={handleRemove}
      />

      <CommentList
        postId={postId}
        comments={comments}
        allLoaded={allLoaded}
        onLoadMore={handleLoadMore}
      />
    </section>
  );
}
