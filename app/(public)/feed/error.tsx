"use client";

import { FeedIllustration } from "@/components/feed/FeedIllustration";
import { Reveal } from "@/components/motion/Reveal";

/**
 * The empty-state shape with the error tone. Not `EmptyState` itself: recovery here is
 * a `reset()` callback rather than a destination, and bending that component
 * to take an onClick would make its one clear contract two.
 */
export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-7 px-6 py-24 text-center">
        <Reveal y={16} scale={0.94} className="relative">
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] blur-3xl"
          />
          <div
            className="relative text-[color:var(--muted-foreground)] opacity-60"
            aria-hidden="true"
          >
            <FeedIllustration variant="error" className="h-auto w-36" />
          </div>
        </Reveal>

        <Reveal y={16} delay={90} className="flex flex-col gap-3">
          <h2 className="text-[20px] font-bold leading-tight text-[color:var(--destructive-text)]">
            Something&apos;s not right.
          </h2>
          <p className="text-[16px] leading-[1.6] text-[color:var(--muted-foreground)]">
            The feed didn&apos;t load. Try again in a moment.
          </p>
        </Reveal>

        <Reveal y={16} delay={170} className="flex flex-col items-center gap-5">
          <button type="button" onClick={reset} className="aiesec-btn-primary">
            Retry
          </button>

          <p className="text-[13px] leading-[1.6] text-[color:var(--muted-foreground)]">
            If this keeps happening, contact MC IM
            {error.digest && (
              <>
                {" "}
                and quote{" "}
                <span className="tabular font-mono text-[12px] text-[color:var(--foreground)]">
                  {error.digest}
                </span>
              </>
            )}
            .
          </p>
        </Reveal>
      </div>
    </main>
  );
}
