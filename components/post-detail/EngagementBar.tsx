"use client";

import { Check, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";

import { BookmarkButton } from "@/components/engagement/BookmarkButton";
import { ReactionButton } from "@/components/engagement/ReactionButton";

type Props = {
  postId: string;
  initialReacted: boolean;
  initialReactionCount: number;
  initialBookmarked: boolean;
  commentCount: number;
};

// One element repositioned per breakpoint. Rendering it twice would give
// ReactionButton two instances whose optimistic state could diverge.
export function EngagementBar({
  postId,
  initialReacted,
  initialReactionCount,
  initialBookmarked,
  commentCount,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div
      className={[
        "fixed bottom-0 left-0 right-0 z-30",
        "border-t border-[var(--border)] bg-[var(--card)] px-6 py-3",
        "flex items-center justify-around gap-4",
        "md:static md:my-8",
        "md:border-y md:bg-transparent md:px-0 md:py-4",
        "md:justify-start md:gap-8",
      ].join(" ")}
    >
      <ReactionButton
        postId={postId}
        initialReacted={initialReacted}
        initialCount={initialReactionCount}
      />

      <a
        href="#comments"
        className="flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-sm)] px-1 text-[15px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        <MessageCircle size={18} strokeWidth={2} aria-hidden />
        <span>{commentCount}</span>
        <span className="sr-only"> comments — jump to the discussion</span>
      </a>

      <button
        type="button"
        onClick={handleShare}
        className="flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-sm)] px-1 text-[15px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        {copied ? (
          <>
            <Check
              size={18}
              strokeWidth={2}
              className="text-[color:var(--success-text)]"
              aria-hidden
            />
            <span className="text-[color:var(--success-text)]">Copied</span>
          </>
        ) : (
          <>
            <Share2 size={18} strokeWidth={2} aria-hidden />
            <span>Share</span>
          </>
        )}
      </button>

      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>

      <div className="md:ml-auto">
        <BookmarkButton postId={postId} initialBookmarked={initialBookmarked} />
      </div>
    </div>
  );
}
