import Link from "next/link";

import { Reveal } from "@/components/motion/Reveal";
import { DisplayTitle } from "@/components/ui/DisplayTitle";

/**
 * Empty and error states, as one component and as type rather than as
 * illustration.
 *
 * The floating glow-orb graphic went with the redesign — a drawing in an
 * empty state is decoration standing where an explanation should be. It says
 * "nothing here" in a language the rest of the product doesn't speak, and
 * looks identical whether the feed is empty, the search found nothing, or
 * the network is down. A sentence set in the display serif says which.
 *
 * `tone` switches the accent from brand blue to the warning colour — the one
 * variation any caller has needed, and never the only cue, since the sentence
 * itself says what happened.
 */
export function EmptyState({
  heading,
  accentWord,
  body,
  action,
  secondaryAction,
  tone = "neutral",
  headingLevel = "h2",
  eyebrow,
}: {
  heading: string;
  /** A word from `heading` to set italic in the accent colour. */
  accentWord?: string;
  body: string;
  action?: { href: string; label: string };
  /** A quieter second way out, when there is more than one. */
  secondaryAction?: { href: string; label: string };
  tone?: "neutral" | "error";
  /** h1 where the empty state replaces the page's only heading. */
  headingLevel?: "h1" | "h2";
  /** The state's own name, in the instrument register. */
  eyebrow?: string;
}) {
  const accentColor = tone === "error" ? "var(--destructive-text)" : "var(--primary-text)";

  // Left at the page margin rather than centred: a centred column of
  // left-aligned text floats, and the states this replaces are the ones a
  // reader lands on by accident — they should start where every other line on
  // the page starts.
  return (
    <div className="flex w-full max-w-[52ch] flex-col items-start gap-6 py-24">
      {eyebrow && (
        <Reveal y={12}>
          <p className="pulse-label pulse-label-wide">{eyebrow}</p>
        </Reveal>
      )}

      <Reveal y={16}>
        <DisplayTitle
          as={headingLevel}
          size="md"
          title={heading}
          accentWord={accentWord}
          accentColor={accentColor}
          className="text-[color:var(--foreground)]"
        />
      </Reveal>

      <Reveal y={16} delay={90}>
        <p className="max-w-[46ch] text-[17px] leading-[1.6] text-[color:var(--muted-foreground)]">
          {body}
        </p>
      </Reveal>

      {(action || secondaryAction) && (
        <Reveal y={16} delay={170} className="flex flex-wrap items-center gap-5">
          {action && (
            <Link href={action.href} className="pulse-action">
              {action.label}
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="pulse-label pulse-underline min-h-[36px] inline-flex items-center rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              {secondaryAction.label}
            </Link>
          )}
        </Reveal>
      )}
    </div>
  );
}
