"use client";

import { useState } from "react";
import { MessageCircle, Share2, Check } from "lucide-react";
import { LikeButton } from "@/components/engagement/LikeButton";

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
  const [copied, setCopied] = useState(false);

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Single DOM element: `fixed bottom-0` on mobile, `static` (in-flow) on desktop.
  // This avoids rendering the bar twice and ensures LikeButton has exactly one
  // instance — so its optimistic state stays consistent regardless of which bar
  // the user interacts with.
  return (
    <div
      className={[
        // Mobile: fixed strip pinned to bottom of viewport
        "fixed bottom-0 left-0 right-0 z-30",
        "border-t border-[var(--border)] bg-[var(--card)] px-6 py-3",
        "flex items-center justify-around gap-4",
        // Desktop: back into document flow, above #comments
        "md:static md:my-8",
        "md:border-y md:bg-transparent md:px-0 md:py-4",
        "md:justify-start md:gap-8",
      ].join(" ")}
    >
      <LikeButton
        postId={postId}
        initialLiked={initialLiked}
        initialCount={initialLikeCount}
      />

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
        className="flex items-center gap-1.5 text-[15px] font-bold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
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
    </div>
  );
}
