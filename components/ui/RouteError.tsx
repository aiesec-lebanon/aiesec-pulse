"use client";

import { Reveal } from "@/components/motion/Reveal";
import { DisplayTitle } from "@/components/ui/DisplayTitle";

/**
 * Not `EmptyState`: recovery here is a `reset()` callback, not a destination.
 */
export function RouteError({
  error,
  reset,
  eyebrow = "Connection lost",
  heading = "Couldn't reach the network",
  accentWord = "network",
  body = "Your connection dropped mid-request. Nothing you had open was lost — try again when you're back.",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  eyebrow?: string;
  heading?: string;
  accentWord?: string;
  body?: string;
}) {
  return (
    <div className="flex w-full max-w-[52ch] flex-col items-start gap-6 py-24">
      <Reveal y={12}>
        <p className="pulse-label pulse-label-wide">{eyebrow}</p>
      </Reveal>

      <Reveal y={16}>
        <DisplayTitle
          as="h2"
          size="md"
          title={heading}
          accentWord={accentWord}
          accentColor="var(--destructive-text)"
          className="text-[color:var(--foreground)]"
        />
      </Reveal>

      <Reveal y={16} delay={90}>
        <p className="max-w-[46ch] text-[17px] leading-[1.6] text-[color:var(--muted-foreground)]">
          {body}
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
  );
}
