"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";

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
 *
 * The active state is a single measured pill that slides between the two tabs,
 * matching the shell's primary-nav indicator, so "this is currently on" moves
 * the same way everywhere in the product. Nothing about the ARIA contract
 * changes: the pill is `aria-hidden` paint over unchanged tab semantics.
 */
export function FeedModeToggle({ mode }: { mode: FeedMode }) {
  const [isPending, startTransition] = useTransition();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ x: 0, w: 0 });

  const measure = useCallback(() => {
    const index = TABS.findIndex((tab) => tab.key === mode);
    const el = tabRefs.current[index];
    if (!el) return;
    setPill({ x: el.offsetLeft, w: el.offsetWidth });
  }, [mode]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

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
      ref={listRef}
      role="tablist"
      aria-label="Feed order"
      className={[
        "relative inline-flex gap-1 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--card)] p-1 shadow-[var(--elev-1)] transition-opacity",
        isPending ? "opacity-70" : "",
      ].join(" ")}
    >
      <span
        aria-hidden
        className="absolute bottom-1 top-1 rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_28%,transparent)] transition-[transform,width] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]"
        style={{ transform: `translateX(${pill.x - 4}px)`, width: `${pill.w}px` }}
      />

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
              "relative z-10 min-h-[38px] rounded-[var(--radius-sm)] px-4 text-[15px] font-bold transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
              "disabled:cursor-not-allowed",
              active
                ? "text-[color:var(--primary-text)]"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
