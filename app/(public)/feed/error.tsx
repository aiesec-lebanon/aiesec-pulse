"use client";

import { Reveal } from "@/components/motion/Reveal";
import { DisplayTitle } from "@/components/ui/DisplayTitle";

/**
 * The empty-state shape with the error tone (9b in the reference file) —
 * type-led, no illustration. Not `EmptyState` itself: recovery here is a
 * `reset()` callback rather than a destination, and bending that component
 * to take an onClick would make its one clear contract two. The layout and
 * classes below are `EmptyState`'s own, so the two still read as the same
 * pattern.
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
      <div className="flex w-full max-w-[52ch] flex-col items-start gap-6 py-24">
        <Reveal y={12}>
          <p className="pulse-label pulse-label-wide">Connection lost</p>
        </Reveal>

        <Reveal y={16}>
          <DisplayTitle
            as="h2"
            size="md"
            title="Couldn't reach the network"
            accentWord="network"
            accentColor="var(--destructive-text)"
            className="text-[color:var(--foreground)]"
          />
        </Reveal>

        <Reveal y={16} delay={90}>
          <p className="max-w-[46ch] text-[17px] leading-[1.6] text-[color:var(--muted-foreground)]">
            Your connection dropped mid-request. Nothing you had open was lost — try again when
            you&apos;re back.
          </p>
        </Reveal>

        <Reveal y={16} delay={170} className="flex flex-col items-start gap-5">
          <button type="button" onClick={reset} className="pulse-action">
            Try again
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
