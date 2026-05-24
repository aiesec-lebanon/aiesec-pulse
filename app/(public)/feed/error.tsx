"use client";

import { FeedIllustration } from "@/components/feed/FeedIllustration";

export default function FeedError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex-1 mx-auto w-full max-w-[1200px] px-6 py-24">
      <div className="flex flex-col items-center text-center gap-6">
        <div
          className="text-[var(--muted-foreground)] opacity-60"
          aria-hidden="true"
        >
          <FeedIllustration variant="error" className="w-36 h-auto" />
        </div>

        <div className="flex flex-col gap-3 max-w-sm">
          <h2 className="text-[20px] font-bold text-[var(--foreground)]">
            Something&apos;s off on our end.
          </h2>
          <p className="text-[16px] leading-[1.6] text-[var(--muted-foreground)]">
            We&apos;re looking into it. Try refreshing in a moment.
          </p>
        </div>

        <button type="button" onClick={reset} className="aiesec-btn-secondary">
          Try again
        </button>
      </div>
    </main>
  );
}
