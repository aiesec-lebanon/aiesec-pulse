"use client";

import { useRef, useTransition } from "react";

import { setFeedMode } from "@/app/actions/feed-preferences";
import type { FeedMode } from "@/lib/feed-mode";

const TABS: Array<{ key: FeedMode; label: string }> = [
  { key: "for-you", label: "For You" },
  { key: "latest", label: "Latest" },
];

/**
 * §7.3's nav-tabs pattern, as a real 2-tab role="tablist" — unlike
 * AudiencePicker's scope selector (§10.12), which deliberately stayed a
 * plain aria-pressed button group because a roving-tabindex tablist wasn't
 * fully implemented there. §7.3 commits this specific widget to tablist, so
 * this one implements the ARIA APG pattern properly rather than repeating
 * that under-implementation: aria-selected, roving tabindex, and
 * Left/Right/Home/End move focus and activate together (automatic
 * activation), which suits an immediate feed-order switch.
 *
 * Setting the cookie inside setFeedMode (a Server Action invoked via this
 * client transition) re-renders the current route in the same response —
 * no separate router.refresh() needed, same as QueueCard's handleApprove.
 */
export function FeedModeToggle({ mode }: { mode: FeedMode }) {
  const [isPending, startTransition] = useTransition();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectMode(next: FeedMode) {
    if (next === mode || isPending) return;
    startTransition(async () => {
      await setFeedMode(next);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIndex = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex === null) return;

    e.preventDefault();
    tabRefs.current[nextIndex]?.focus();
    selectMode(TABS[nextIndex].key);
  }

  return (
    <div
      role="tablist"
      aria-label="Feed order"
      className={[
        "inline-flex gap-1 rounded-[var(--radius-md)] bg-[var(--muted)] p-1 transition-opacity",
        isPending ? "opacity-70" : "",
      ].join(" ")}
    >
      {TABS.map((tab, index) => {
        const active = tab.key === mode;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={isPending}
            onClick={() => selectMode(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={[
              "relative min-h-[36px] rounded-[var(--radius-sm)] px-4 text-[15px] font-bold transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
              "disabled:cursor-not-allowed",
              active
                ? "bg-[var(--card)] text-[var(--foreground)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
