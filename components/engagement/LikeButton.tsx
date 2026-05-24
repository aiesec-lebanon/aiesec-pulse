"use client";

import { useState, useRef } from "react";
import { Heart } from "lucide-react";
import { toggleLike } from "@/app/actions/likes";

type Props = {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
};

const DEBOUNCE_MS = 300;

export function LikeButton({ postId, initialLiked, initialCount }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [showError, setShowError] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function dismissError() {
    setShowError(false);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  }

  function triggerError() {
    setShowError(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(dismissError, 3000);
  }

  function handleClick() {
    dismissError();

    const nextLiked = !liked;
    // Capture stable pre-click values for revert if the debounced call fails.
    // Because each rapid click cancels the previous timeout, the last click's
    // closure captures the state just before that click — i.e. the last known
    // server-consistent state — which is the correct revert target.
    const revertLiked = liked;
    const revertCount = count;

    // Optimistic update
    setLiked(nextLiked);
    setCount((prev) => (nextLiked ? prev + 1 : prev - 1));

    // Debounce: cancel any pending call and schedule a new one
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await toggleLike(postId);
        // Reconcile to the server's authoritative state
        setLiked(result.liked);
        setCount(result.count);
      } catch {
        setLiked(revertLiked);
        setCount(revertCount);
        triggerError();
      }
    }, DEBOUNCE_MS);
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        aria-label={liked ? "Unlike this post" : "Like this post"}
        aria-pressed={liked}
        className={[
          "flex items-center gap-1.5 text-[15px] font-bold transition-colors",
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
        <span>{count}</span>
      </button>

      {/* Error tooltip — appears above the button, auto-dismisses after 3 s */}
      {showError && (
        <div
          role="alert"
          aria-live="assertive"
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--foreground)] px-3 py-1.5 text-[12px] font-medium text-[var(--card)]"
        >
          Couldn&apos;t update like — try again.
        </div>
      )}
    </div>
  );
}
