"use client";

import { FeedIllustration } from "@/components/feed/FeedIllustration";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 flex-shrink-0 border-b border-[var(--border)] bg-[var(--card)] flex items-center px-6">
        <span className="text-[16px] font-bold text-[color:var(--foreground)]">
          AIESEC Pulse · Moderator
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="flex flex-col items-center text-center gap-6 max-w-sm">
          <div className="text-[color:var(--muted-foreground)] opacity-60" aria-hidden="true">
            <FeedIllustration variant="error" className="w-36 h-auto" />
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-[20px] font-bold text-[color:var(--foreground)]">
              An error occurred in the moderator portal.
            </h2>
            <p className="text-[16px] leading-[1.6] text-[color:var(--muted-foreground)]">
              Something went wrong. Please try again.
            </p>
          </div>

          <button type="button" onClick={reset} className="aiesec-btn-primary">
            Retry
          </button>

          {error.digest && (
            <p className="text-[12px] font-mono text-[color:var(--muted-foreground)] opacity-60">
              ID: {error.digest}
            </p>
          )}

          <p className="text-[13px] text-[color:var(--muted-foreground)]">
            If this keeps happening, contact MC IM.
          </p>
        </div>
      </main>
    </div>
  );
}
