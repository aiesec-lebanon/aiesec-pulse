"use client";

import { useEffect, useRef, useState } from "react";

type RevealProps = {
  children: React.ReactNode;
  /** Direction and distance the element travels in from. */
  y?: number;
  x?: number;
  /** Starting scale. */
  scale?: number;
  /** Starting blur in px. Defaults to the system value; 0 disables it. */
  blur?: number;
  /** Stagger position within a group, in milliseconds. */
  delay?: number;
  /** Fraction of the element that must be visible before it reveals. */
  threshold?: number;
  as?: "div" | "section" | "article" | "li" | "header" | "aside";
  className?: string;
};

/**
 * The app's entrance animation. `data-reveal` (what globals.css hangs
 * `opacity: 0` off) is only set once mounted and observing, so a crawler,
 * failed hydration, or JS-disabled browser sees full content, never a blank
 * page. Reveals once and disconnects — re-hiding on scroll-out feels broken.
 */
export function Reveal({
  children,
  y = 24,
  x = 0,
  scale = 1,
  blur,
  delay = 0,
  threshold = 0.12,
  as: Tag = "div",
  className,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Anything already on screen at mount (the hero, above-the-fold cards)
    // must not sit hidden waiting for a scroll that may never come.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) {
      setArmed(true);
      // One frame armed-but-not-shown, so the browser has a "from" state to
      // transition out of; flipping both in the same commit renders it done.
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }

    setArmed(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        // isIntersecting alone misses elements that jump fully past the
        // viewport between frames (flick, scrollbar drag, anchor jump) —
        // treat "top already above viewport" as scrolled-past and show it.
        if (!entry.isIntersecting && entry.boundingClientRect.top > 0) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Tag
      // The union of allowed tags all accept a plain element ref; TS cannot
      // narrow that through a dynamic tag name without a per-tag overload.
      ref={ref as React.Ref<never>}
      className={className}
      data-reveal={armed ? (shown ? "in" : "out") : undefined}
      style={
        {
          "--reveal-y": `${y}px`,
          "--reveal-x": `${x}px`,
          "--reveal-scale": scale,
          ...(blur === undefined ? {} : { "--reveal-blur": `${blur}px` }),
          "--reveal-delay": `${delay}ms`,
        } as React.CSSProperties
      }
    >
      {children}
    </Tag>
  );
}
