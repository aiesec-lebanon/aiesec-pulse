"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reading progress.
 *
 * The value it reports is informational, not decorative, so it renders under
 * every motion setting — the Motion preference only governs the fill's
 * *easing*, via `--motion-scale`. At Reduced the width snaps to the scrolled
 * position instead of gliding; the bar itself never disappears.
 *
 * The width is written straight to the element from the rAF callback rather
 * than through state: this fires on every scroll frame, and re-rendering a
 * React tree sixty times a second to move one bar is the classic way this
 * kind of component makes a page feel heavy. State is kept only for the
 * `aria-valuenow` announcement, and only when the rounded percentage changes.
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
