"use client";

import { useCallback, useState } from "react";

import { CommentComposer } from "@/components/engagement/CommentComposer";
import { CommentList } from "@/components/engagement/CommentList";
import type { CommentDto } from "@/types/comment";

type Props = {
  postId: string;
  totalCount: number;
  initialComments: CommentDto[];
  currentUserName: string;
};

export function CommentsSection({ postId, totalCount, initialComments, currentUserName }: Props) {
  const [comments, setComments] = useState<CommentDto[]>(initialComments);
  const [optimisticCount, setOptimisticCount] = useState(0);
  const [allLoaded, setAllLoaded] = useState(totalCount <= initialComments.length);

  const handleOptimisticAdd = useCallback((optimistic: CommentDto) => {
    setComments((prev) => [optimistic, ...prev]);
    setOptimisticCount((c) => c + 1);
  }, []);

  const handleConfirm = useCallback((optimistic: CommentDto, confirmed: CommentDto) => {
    setComments((prev) => prev.map((c) => (c.id === optimistic.id ? confirmed : c)));
  }, []);

  const handleRemove = useCallback((optimistic: CommentDto) => {
    setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
    setOptimisticCount((c) => c - 1);
  }, []);

  const handleLoadMore = useCallback((more: CommentDto[]) => {
    setComments((prev) => [...prev, ...more]);
    if (more.length < 20) setAllLoaded(true);
  }, []);

  const displayedCount = totalCount + optimisticCount;

  return (
    <section id="comments" aria-labelledby="comments-heading">
      <h2
        id="comments-heading"
        className="mb-6 text-[20px] font-bold text-[color:var(--foreground)]"
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
