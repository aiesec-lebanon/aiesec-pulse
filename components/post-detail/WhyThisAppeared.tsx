import { ChevronDown } from "lucide-react";

import type { ProximityTier, ScoredPost } from "@/lib/feed";

// <details>/<summary> needs no custom ARIA — the browser owns expanded state.
// Negligible terms (e.g. "+0.00") are left out so the list only shows terms
// that actually moved this post.

const NEGLIGIBLE = 0.01;

function proximityLabel(tier: ProximityTier): string {
  switch (tier) {
    case "same-entity":
      return "Published by your own entity";
    case "same-mc":
      return "Published within your MC";
    case "same-region":
      return "Published within your region";
    default:
      return "Shared network-wide";
  }
}

function reasonsFor(terms: ScoredPost["terms"]): string[] {
  const reasons: string[] = [];

  if (Math.abs(terms.recency.weighted) > NEGLIGIBLE) reasons.push("Published recently");
  reasons.push(proximityLabel(terms.proximity.tier));
  if (terms.affinity.followedCount > 0) reasons.push("Matches a topic or entity you follow");
  if (terms.affinity.mutedCount > 0) {
    reasons.push("Includes a topic or entity you've muted — ranked lower");
  }
  if (terms.signal.value > 0) reasons.push("Popular with the network");
  if (terms.priority.pinned) reasons.push("Pinned for your attention");
  if (terms.priority.needsAck) reasons.push("Needs your acknowledgement");
  if (terms.seen.alreadyRead) reasons.push("You've already read this — ranked lower");

  return reasons;
}

export function WhyThisAppeared({ breakdown }: { breakdown: ScoredPost }) {
  const reasons = reasonsFor(breakdown.terms);
  if (reasons.length === 0) return null;

  return (
    <details className="group mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)]">
      <summary
        className={[
          "flex min-h-[36px] cursor-pointer list-none items-center gap-1.5 px-4 py-2 text-[14px] font-bold text-[color:var(--muted-foreground)]",
          "transition-colors hover:text-[color:var(--foreground)]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
          "[&::-webkit-details-marker]:hidden",
        ].join(" ")}
      >
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className="shrink-0 transition-transform duration-200 group-open:rotate-180"
        />
        Why am I seeing this?
      </summary>

      <ul className="flex flex-col gap-1.5 border-t border-[var(--border)] px-4 py-3 text-[13px] text-[color:var(--muted-foreground)]">
        {reasons.map((reason) => (
          <li key={reason} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-foreground)]"
            />
            {reason}
          </li>
        ))}
      </ul>
    </details>
  );
}
