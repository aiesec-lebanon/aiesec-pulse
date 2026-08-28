"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { toggleBookmark } from "@/app/actions/bookmarks";

type Props = {
  postId: string;
  initialBookmarked: boolean;
  /** A word beside the mark. Off by default — the bar is tight on mobile. */
  withLabel?: boolean;
};

const DEBOUNCE_MS = 300;

// Same shape as ReactionButton: debounced so a double-tap can't fire
// two round-trips whose responses arrive out of order, optimistic with
// revert-on-failure, aria-live announced, and the same one-shot press
// animations (overshoot plus a dissolving ring) so saving a story feels
// like an event, not a colour change.
export function BookmarkButton({ postId, initialBookmarked, withLabel = false }: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
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

    const next = !bookmarked;
    const revert = bookmarked;
    setBookmarked(next);
    setPressKey((k) => k + 1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await toggleBookmark(postId);
        if (!result.ok) throw new Error(result.error);
        setBookmarked(result.bookmarked);
      } catch {
        setBookmarked(revert);
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
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark this post"}
        className={[
          "group/save flex min-h-[36px] min-w-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-1 text-[15px] font-bold transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
          bookmarked
            ? "text-[color:var(--primary-text)]"
            : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
        ].join(" ")}
      >
        <span className="relative flex h-[18px] w-[18px] items-center justify-center">
          {pressKey > 0 && bookmarked && (
            <span key={`burst-${pressKey}`} aria-hidden className="pulse-burst" />
          )}
          <Bookmark
            key={`mark-${pressKey}`}
            size={18}
            strokeWidth={2}
            className={[
              pressKey > 0 ? "pulse-pop" : "",
              "relative transition-[transform,fill] duration-[calc(var(--dur-micro)*var(--motion-scale))]",
              bookmarked
                ? "fill-[var(--primary-text)]"
                : "group-hover/save:-translate-y-[calc(1px*var(--motion-travel))]",
            ].join(" ")}
            aria-hidden
          />
        </span>
        {withLabel && <span aria-hidden>{bookmarked ? "Saved" : "Save"}</span>}
      </button>

      <span aria-live="polite" className="sr-only">
        {bookmarked ? "Bookmarked" : "Bookmark removed"}
      </span>

      {error && (
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
