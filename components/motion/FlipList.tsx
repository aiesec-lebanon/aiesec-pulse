"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * FLIP reorder animation: measure boxes before/after the DOM update, invert
 * the diff into a transform, then clear it next frame so CSS eases it home.
 * Identity is `data-flip-key`, not index — a key missing from the previous
 * measurement means "new" and gets the enter animation, not a move.
 */
export function FlipList({
  children,
  className,
  /** Bumped by the caller whenever the list's order or membership changes. */
  revision,
  as: Tag = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  revision: unknown;
  as?: "div" | "ul" | "ol";
} & React.HTMLAttributes<HTMLElement>) {
  const containerRef = useRef<HTMLElement>(null);
  const boxesRef = useRef<Map<string, DOMRect>>(new Map());
  const firstRunRef = useRef(true);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = Array.from(container.querySelectorAll<HTMLElement>("[data-flip-key]"));
    const previous = boxesRef.current;
    const next = new Map<string, DOMRect>();

    for (const item of items) {
      const key = item.dataset.flipKey!;
      // Clear any transform left over from an interrupted run before
      // measuring, or the "Last" position is really the previous inverse.
      item.style.removeProperty("--flip-x");
      item.style.removeProperty("--flip-y");
      item.classList.remove("pulse-flip-move");
      const box = item.getBoundingClientRect();
      next.set(key, box);

      if (firstRunRef.current) continue;

      const before = previous.get(key);
      if (!before) {
        item.classList.remove("pulse-flip-enter");
        // Force a reflow so removing and re-adding the class restarts the
        // animation for an item re-entering the list.
        void item.offsetWidth;
        item.classList.add("pulse-flip-enter");
        continue;
      }

      const dx = before.left - box.left;
      const dy = before.top - box.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      item.classList.remove("pulse-flip-enter");
      item.style.setProperty("--flip-x", `${dx}px`);
      item.style.setProperty("--flip-y", `${dy}px`);
    }

    boxesRef.current = next;
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    // Play: one frame later, so the inverted position has been painted.
    const raf = requestAnimationFrame(() => {
      for (const item of items) {
        if (!item.style.getPropertyValue("--flip-x") && !item.style.getPropertyValue("--flip-y")) {
          continue;
        }
        item.classList.add("pulse-flip-move");
        item.style.setProperty("--flip-x", "0px");
        item.style.setProperty("--flip-y", "0px");
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [revision]);

  return (
    <Tag ref={containerRef as React.Ref<never>} className={className} {...rest}>
      {children}
    </Tag>
  );
}
