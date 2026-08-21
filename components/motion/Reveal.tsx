"use client";

import { useEffect, useRef, useState } from "react";

type RevealProps = {
  children: React.ReactNode;
  /** Direction and distance the element travels in from. */
  y?: number;
  x?: number;
  /** Starting scale — 0.96 gives a subtle push-in without a visible pop. */
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
 * The single entrance grammar for the whole app.
 *
 * Two rules make this safe rather than the usual scroll-animation trap:
 *
 * 1. Content is visible by default. The `data-reveal` attribute — the thing
 *    globals.css hangs `opacity: 0` off — is only written once this component
 *    has mounted and an observer is live. A crawler, a failed hydration, or a
 *    JS-disabled browser therefore sees fully rendered content, never a blank
 *    page waiting for an event that will not fire.
 *
 * 2. It reveals once and disconnects. Content that re-hides when it leaves the
 *    viewport makes a page feel broken on the way back up, and keeps an
 *    observer alive for the session.
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
        // `isIntersecting` alone is not enough. IntersectionObserver evaluates
        // at frame boundaries, so an element that travels fully past the
        // viewport between two frames — a wheel flick, a scrollbar drag, an
        // in-page anchor jump — is never reported as intersecting, and would
        // stay invisible for the rest of the session. Anything whose top has
        // gone above the viewport has been scrolled past and must be shown.
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
