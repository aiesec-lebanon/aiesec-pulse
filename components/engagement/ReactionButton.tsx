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

/**
 * Debounced because a double-tap would fire two round-trips whose responses
 * can arrive out of order.
 *
 * The press is *felt*: the heart overshoots and settles, a ring of the
 * reaction colour throws off the control and dissolves, and the new figure
 * rolls up from the old one's place inside a clipped window. All three are
 * one-shot animations on keyed elements — they play once per press, never
 * loop, and collapse to nothing under Reduced via `--motion-scale` /
 * `--motion-travel`. A reaction stays confirmed by colour, fill, and the
 * live region — the parts that carry meaning.
 *
 * `pressKey`, not a boolean "animating" flag: remounting the animated
 * elements restarts a CSS animation, while a flag would need a timer to
 * clear it — one more thing to get wrong on unmount.
 */
export function ReactionButton({ postId, initialReacted, initialCount }: Props) {
  const [reacted, setReacted] = useState(initialReacted);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [pressKey, setPressKey] = useState(0);

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
    // The surviving closure holds the last server-consistent state — the
    // correct revert target.
    const revertReacted = reacted;
    const revertCount = count;

    setReacted(next);
    setCount((prev) => (next ? prev + 1 : Math.max(0, prev - 1)));
    setPressKey((k) => k + 1);

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
          "group/react flex min-h-[36px] min-w-[44px] items-center gap-1.5 rounded-[var(--radius-sm)] px-1 text-[15px] font-bold transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
          reacted
            ? "text-[color:var(--destructive-text)]"
            : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
        ].join(" ")}
      >
        <span className="relative flex h-[18px] w-[18px] items-center justify-center">
          {/* The ring only exists for the press that produced it. */}
          {pressKey > 0 && reacted && (
            <span
              key={`burst-${pressKey}`}
              aria-hidden
              className="pulse-burst"
              style={{ ["--burst-color" as string]: "var(--glow-destructive)" }}
            />
          )}
          <Heart
            key={`heart-${pressKey}`}
            size={18}
            strokeWidth={2}
            className={[
              pressKey > 0 ? "pulse-pop" : "",
              "relative transition-[transform,fill] duration-[calc(var(--dur-micro)*var(--motion-scale))]",
              reacted
                ? "fill-[var(--destructive)]"
                : "group-hover/react:scale-[calc(1+0.12*var(--motion-travel))]",
            ].join(" ")}
            aria-hidden
          />
        </span>

        {/* A counter that changes should not merely become a different number. */}
        <span aria-hidden className="pulse-roll-window">
          <span key={count} className="pulse-roll">
            {count}
          </span>
        </span>
      </button>

      <span aria-live="polite" className="sr-only">
        {count} {count === 1 ? "reaction" : "reactions"}
        {reacted ? ", including yours" : ""}
      </span>

      {error && (
        // The translate that centres the tooltip and the translate that
        // animates it in are two different jobs, on two elements: an animation
        // that writes `transform` would otherwise overwrite the centring and
        // leave the tooltip hanging off to one side.
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
          <div
            role="alert"
            className="pulse-copy-in whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--foreground)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--card)]"
            style={{ ["--copy-y" as string]: "6px" }}
          >
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
