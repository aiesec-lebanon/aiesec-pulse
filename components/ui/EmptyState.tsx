import Link from "next/link";

import { FeedIllustration } from "@/components/feed/FeedIllustration";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Empty & error state (§10.9), as one component.
 *
 * The feed, search and topic-archive pages each carried their own copy of this
 * markup — same illustration, same float animation, three sets of headings at
 * two different levels. §10.9 already described a single canonical shape; it
 * just had no component to point at.
 *
 * `tone` switches the heading colour for a failure rather than an absence,
 * which is the one variation §10.9 actually calls for.
 */
export function EmptyState({
  heading,
  body,
  action,
  tone = "neutral",
  headingLevel = "h2",
}: {
  heading: string;
  body: string;
  action?: { href: string; label: string };
  tone?: "neutral" | "error";
  /** h1 where the empty state replaces the page's only heading. */
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-7 px-6 py-24 text-center">
      <Reveal y={16} scale={0.94} className="relative">
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--glow-primary-soft)] blur-3xl"
        />
        <div
          className="animate-float-drift pulse-ambient relative text-[color:var(--muted-foreground)] opacity-60"
          aria-hidden="true"
        >
          <FeedIllustration className="h-auto w-36" />
        </div>
      </Reveal>

      <Reveal y={16} delay={90} className="flex flex-col gap-3">
        <Heading
          className={[
            "text-[20px] font-bold leading-tight",
            tone === "error"
              ? "text-[color:var(--destructive-text)]"
              : "text-[color:var(--foreground)]",
          ].join(" ")}
        >
          {heading}
        </Heading>
        <p className="text-[16px] leading-[1.6] text-[color:var(--muted-foreground)]">{body}</p>
      </Reveal>

      {action && (
        <Reveal y={16} delay={170}>
          <Link href={action.href} className="aiesec-btn-primary">
            {action.label}
          </Link>
        </Reveal>
      )}
    </div>
  );
}
