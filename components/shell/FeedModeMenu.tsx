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
 * Only rendered under /feed. `open` is controlled by NavRail on desktop
 * (owns hover intent); the mobile drawer falls back to its own click state.
 * Hover only adds a path in — chevron/Enter/Escape still work standalone.
 * `mode` is a prop, not state: setFeedMode refreshes the route itself.
 */
export function FeedModeMenu({
  mode,
  open: controlledOpen,
  onOpenChange,
}: {
  mode: FeedMode;
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    if (onOpenChange) onOpenChange(next);
    else setUncontrolledOpen(next);
  }

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
    // `setOpen` closes over props that are stable for the lifetime of a mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onOpenChange]);

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
        onClick={() => setOpen(!open)}
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
        <>
          {/* Pointer-safe corridor to the panel — else the menu closes mid-crossing. */}
          <span aria-hidden className="pulse-menu-bridge" />
          <div
            role="menu"
            aria-label="Feed order"
            className="pulse-copy-in absolute left-0 top-full z-50 mt-2.5 w-[238px] origin-top-left rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--card)] p-1.5 shadow-[var(--elev-4)]"
            style={{ ["--copy-y" as string]: "-8px" }}
          >
            {OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="menuitemradio"
                aria-checked={option.key === mode}
                onClick={() => choose(option.key)}
                className="group flex w-full items-start gap-2 rounded-[var(--radius-sm)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-[color:var(--foreground)]">
                    {option.label}
                  </span>
                </span>
                <Check
                  size={14}
                  strokeWidth={2.5}
                  aria-hidden
                  className={[
                    "mt-0.5 shrink-0 text-[color:var(--primary-text)] transition-[opacity,transform] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]",
                    option.key === mode ? "opacity-100" : "scale-75 opacity-0",
                  ].join(" ")}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
