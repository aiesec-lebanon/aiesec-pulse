"use client";

import { useState, useTransition } from "react";
import { Heart, MessageCircle, Share2, Check } from "lucide-react";
import { toggleLike } from "@/app/actions/likes";

type Props = {
  postId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  commentCount: number;
};

export function EngagementBar({
  postId,
  initialLiked,
  initialLikeCount,
  commentCount,
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleLike() {
    const nextLiked = !liked;
    // Optimistic update
    setLiked(nextLiked);
    setLikeCount((prev) => (nextLiked ? prev + 1 : prev - 1));

    startTransition(async () => {
      try {
        const result = await toggleLike(postId);
        setLiked(result.liked);
        setLikeCount(result.count);
      } catch {
        // Revert on error
        setLiked(liked);
        setLikeCount(likeCount);
      }
    });
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Rendered in both the desktop inline bar and the mobile sticky bar.
  // Both share the same state from this component's closure.
  const barContent = (
    <>
      <button
        type="button"
        onClick={handleLike}
        disabled={isPending}
        aria-label={liked ? "Unlike this post" : "Like this post"}
        aria-pressed={liked}
        className={[
          "flex items-center gap-1.5 text-[15px] font-bold transition-colors disabled:opacity-60",
          liked
            ? "text-[var(--destructive)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        ].join(" ")}
      >
        <Heart
          size={18}
          strokeWidth={2}
          className={liked ? "fill-[var(--destructive)]" : ""}
          aria-hidden
        />
        <span>{likeCount}</span>
      </button>

      <a
        href="#comments"
        className="flex items-center gap-1.5 text-[15px] font-bold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <MessageCircle size={18} strokeWidth={2} aria-hidden />
        <span>{commentCount}</span>
      </a>

      <button
        type="button"
        onClick={handleShare}
        aria-label="Copy link to this post"
        className="flex items-center gap-1.5 text-[15px] font-bold transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        {copied ? (
          <>
            <Check
              size={18}
              strokeWidth={2}
              className="text-[var(--success)]"
              aria-hidden
            />
            <span className="text-[var(--success)]">Copied!</span>
          </>
        ) : (
          <>
            <Share2 size={18} strokeWidth={2} aria-hidden />
            <span>Share</span>
          </>
        )}
      </button>
    </>
  );

  return (
    <>
      {/* Desktop: inline above comments */}
      <div className="hidden md:flex items-center gap-8 border-y border-[var(--border)] py-4 my-8">
        {barContent}
      </div>

      {/* Mobile: sticky bottom strip — CSS display:none on desktop keeps it out of a11y tree */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around gap-4 border-t border-[var(--border)] bg-[var(--card)] px-6 py-3 md:hidden">
        {barContent}
      </div>
    </>
  );
}
