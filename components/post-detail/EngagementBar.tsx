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

/**
 * One element repositioned per breakpoint — rendering it twice would give
 * ReactionButton two instances whose optimistic state could diverge.
 *
 * **`sticky`, not `fixed`, on narrow viewports.** A `transform` or `filter` on
 * an ancestor makes that ancestor the containing block for fixed descendants,
 * and the shell now animates the whole content column on every route change
 * (`RouteTransition`) — a fixed bar inside it would resolve against the column
 * and vanish off the bottom of the page for the transition's duration. Sticky
 * is unaffected.
 */
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
    } catch {
      // Clipboard denied (an insecure context, or a refused permission).
    }
  }

  return (
    <div
      className={[
        "sticky bottom-0 z-30 -mx-6 mt-8",
        "border-t border-[var(--border)] bg-[var(--scrim)] px-6 py-3 backdrop-blur-md",
        "flex items-center justify-around gap-4",
        "md:static md:mx-0 md:my-8",
        "md:border-y md:bg-transparent md:px-0 md:py-4 md:backdrop-blur-none",
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
        className="group/jump flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-sm)] px-1 text-[15px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        <MessageCircle
          size={18}
          strokeWidth={2}
          aria-hidden
          className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover/jump:-rotate-12"
        />
        <span aria-hidden className="pulse-roll-window">
          <span key={commentCount} className="pulse-roll">
            {commentCount}
          </span>
        </span>
        <span className="sr-only">{commentCount} comments — jump to the discussion</span>
      </a>

      <button
        type="button"
        onClick={handleShare}
        className="group/share flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-sm)] px-1 text-[15px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        {copied ? (
          <>
            <Check
              key="copied"
              size={18}
              strokeWidth={2.5}
              className="pulse-pop text-[color:var(--success-text)]"
              aria-hidden
            />
            <span className="text-[color:var(--success-text)]">Copied</span>
          </>
        ) : (
          <>
            <Share2
              size={18}
              strokeWidth={2}
              aria-hidden
              className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover/share:translate-x-[calc(2px*var(--motion-travel))]"
            />
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
