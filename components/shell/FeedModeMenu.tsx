"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { setFeedMode } from "@/app/actions/feed-preferences";
import type { FeedMode } from "@/lib/feed-mode";

const OPTIONS: Array<{ key: FeedMode; label: string }> = [
  { key: "for-you", label: "For You" },
  { key: "latest", label: "Latest" },
];

/**
 * The feed's order switch, moved into the shell's nav — beside the "Feed"
 * link itself, rather than as a second tab-shaped control on the feed page.
 * Only ever rendered while the pathname is under /feed (see `NavRail`).
 *
 * `mode` is a prop, not local state: `setFeedMode` (the same Server Action
 * `FeedModeToggle` used) refreshes the current route on completion, so the
 * server-computed value flows back down through the layout rather than being
 * mirrored here — the one piece of local state is `isPending`, purely to
 * disable the trigger mid-write.
 */
export function FeedModeMenu({ mode }: { mode: FeedMode }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(next: FeedMode) {
    setOpen(false);
    if (next === mode || isPending) return;
    startTransition(async () => {
      await setFeedMode(next);
    });
  }

  const activeLabel = OPTIONS.find((o) => o.key === mode)?.label ?? "Feed";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Feed order: ${activeLabel}`}
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex min-h-[32px] min-w-[24px] items-center justify-center gap-1 rounded-[var(--radius-sm)] px-1 text-[color:var(--muted-foreground)] transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-60"
      >
        <ChevronDown
          size={13}
          strokeWidth={2.5}
          aria-hidden
          className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Feed order"
          className="insight-enter absolute left-0 top-full mt-2 w-[168px] origin-top-left rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--card)] p-1.5 shadow-[var(--elev-4)]"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="menuitemradio"
              aria-checked={option.key === mode}
              onClick={() => choose(option.key)}
              className="flex min-h-[36px] w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left text-[14px] font-bold text-[color:var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              {option.label}
              {option.key === mode && (
                <Check
                  size={14}
                  strokeWidth={2.5}
                  aria-hidden
                  className="text-[color:var(--primary-text)]"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
