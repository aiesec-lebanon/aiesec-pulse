"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Informational, not decorative — renders under every motion setting;
 * Motion only changes the fill's easing, never hides the bar. Width is
 * written straight to the DOM from the rAF callback, not through state
 * (kept only for the `aria-valuenow` announcement) since re-rendering React
 * 60x/sec to move one bar is heavy. `sticky`, not `fixed` — RouteTransition's
 * transform is the containing block for fixed descendants, so a fixed bar
 * would detach and travel with the page mid-transition (see EngagementBar).
 */
export function ReadingProgress() {
  const fillRef = useRef<HTMLDivElement>(null);
  const [announced, setAnnounced] = useState(0);

  useEffect(() => {
    let ticking = false;
    let lastAnnounced = 0;

    function update() {
      ticking = false;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
      const clamped = Math.min(1, Math.max(0, ratio));

      // scaleX rather than width: a transform is composited, a width change
      // is a layout on every frame of every scroll.
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${clamped})`;

      const percent = Math.round(clamped * 100);
      if (percent !== lastAnnounced) {
        lastAnnounced = percent;
        setAnnounced(percent);
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={announced}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed left-0 right-0 top-0 z-50 h-[3px] bg-[color-mix(in_srgb,var(--border)_50%,transparent)]"
    >
      <div
        ref={fillRef}
        className="h-full origin-left bg-[var(--primary)] shadow-[0_0_12px_0_var(--glow-primary)] transition-transform duration-[calc(120ms*var(--motion-scale))] ease-out"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
