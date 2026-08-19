"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { toggleBookmark } from "@/app/actions/bookmarks";

type Props = {
  postId: string;
  initialBookmarked: boolean;
};

const DEBOUNCE_MS = 300;

// Same shape as ReactionButton (§10.8): debounced so a double-tap can't fire
// two round-trips whose responses arrive out of order, optimistic with a
// revert-on-failure, aria-live announced.
export function BookmarkButton({ postId, initialBookmarked }: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
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

    const next = !bookmarked;
    const revert = bookmarked;
    setBookmarked(next);

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
          "flex min-h-[36px] min-w-[44px] items-center justify-center rounded-[var(--radius-sm)] px-1 transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
          bookmarked
            ? "text-[var(--primary-text)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        ].join(" ")}
      >
        <Bookmark
          size={18}
          strokeWidth={2}
          className={bookmarked ? "fill-[var(--primary-text)]" : ""}
          aria-hidden
        />
      </button>

      <span aria-live="polite" className="sr-only">
        {bookmarked ? "Bookmarked" : "Bookmark removed"}
      </span>

      {error && (
        <div
          role="alert"
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--foreground)] px-3 py-1.5 text-[12px] font-medium text-[var(--card)]"
        >
          {error}
        </div>
      )}
    </div>
  );
}
