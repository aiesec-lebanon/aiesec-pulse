"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * A list whose items *move* when the list reorders, instead of teleporting.
 *
 * The problem this solves is specific and was visible on the feed: the "more
 * top stories" rail drops whichever post the hero is currently showing, so
 * every rotation removes one card and inserts another, and the three cards in
 * between change slot. Rendered plainly, all four appear to blink into new
 * positions at once — the single hardest cut left in the app, firing every
 * eight seconds.
 *
 * FLIP is the standard answer and it is only ~40 lines, so it lives here
 * rather than pulling in an animation library: measure every child's box
 * *before* the DOM updates (First), read it again after (Last), write the
 * difference back as a transform so each child appears not to have moved
 * (Invert), then clear the transform on the next frame and let CSS carry it
 * home (Play).
 *
 * Two details that matter:
 *
 *   - Identity comes from `data-flip-key`, which the caller stamps on each
 *     child. Indices are useless here: the whole point is that item three
 *     became item two.
 *   - A child that was not in the previous measurement is *new*, and gets the
 *     enter animation rather than a move — a card arriving from nowhere should
 *     not slide in from position zero.
 *
 * Reduced motion needs no branch: `.pulse-flip` multiplies its offset by
 * `--motion-travel`, so the inverted transform evaluates to zero and every
 * item is already home on the first frame.
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
        // Force a reflow so removing and re-adding the class actually restarts
        // the animation for an item that is re-entering the list.
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
