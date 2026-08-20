"use client";

import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { toggleReaction } from "@/app/actions/reactions";

type Props = {
  postId: string;
  initialReacted: boolean;
  initialCount: number;
};

const DEBOUNCE_MS = 300;

// Debounced because a double-tap would fire two round-trips whose responses
// can arrive out of order.
export function ReactionButton({ postId, initialReacted, initialCount }: Props) {
  const [reacted, setReacted] = useState(initialReacted);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    []
  );

  function handleClick() {
    setError(null);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);

    const next = !reacted;
    // The surviving closure holds the last server-consistent state, which is the
    // correct revert target.
    const revertReacted = reacted;
    const revertCount = count;

    setReacted(next);
    setCount((prev) => (next ? prev + 1 : Math.max(0, prev - 1)));

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await toggleReaction(postId);
        if (!result.ok) throw new Error(result.error);
        setReacted(result.reacted);
        setCount(result.count);
      } catch {
        setReacted(revertReacted);
        setCount(revertCount);
        setError("Couldn't update — try again.");
        errorTimerRef.current = setTimeout(() => setError(null), 3000);
      }
    }, DEBOUNCE_MS);
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={reacted}
        aria-label={reacted ? "Remove your reaction" : "React to this post"}
        className={[
          "flex min-h-[36px] min-w-[44px] items-center gap-1.5 rounded-[var(--radius-sm)] px-1 text-[15px] font-bold transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
          reacted
            ? "text-[color:var(--destructive-text)]"
            : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
        ].join(" ")}
      >
        <Heart
          size={18}
          strokeWidth={2}
          className={reacted ? "fill-[var(--destructive)]" : ""}
          aria-hidden
        />
        <span aria-hidden>{count}</span>
      </button>

      <span aria-live="polite" className="sr-only">
        {count} {count === 1 ? "reaction" : "reactions"}
        {reacted ? ", including yours" : ""}
      </span>

      {error && (
        <div
          role="alert"
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--foreground)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--card)]"
        >
          {error}
        </div>
      )}
    </div>
  );
}
