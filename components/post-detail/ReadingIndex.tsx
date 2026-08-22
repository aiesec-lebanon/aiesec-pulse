"use client";

import { useEffect, useRef, useState } from "react";

import type { DocumentSection } from "@/lib/content/document";

/**
 * The sticky "in this story" rail — UI ref 2a. Real `<a href="#section-N">`
 * anchors, not click-handler spans: actually addressable, keyboard-operable,
 * and they clear the sticky header on arrival via the `scroll-mt-24` already
 * stamped onto each target heading (DocumentRenderer).
 *
 * The read-percentage figure is scoped to the article content element
 * (`contentId`), not the whole document — this rail is a table of contents
 * for the *story*, and the page keeps going below it (up next, comments), so
 * a page-scroll ratio would still read well under 100% once the reader has
 * genuinely finished. Same rAF-throttled approach `ReadingProgress.tsx`
 * already uses, duplicated deliberately into this new, isolated file rather
 * than factored into a shared hook — `ReadingProgress` (which *is* a
 * whole-page measure, correctly) stays untouched and zero-risk.
 */
export function ReadingIndex({
  sections,
  contentId,
}: {
  sections: DocumentSection[];
  /** The id of the element the read-percentage is measured against. */
  contentId: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const percentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-10% 0px -80% 0px", threshold: 0 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    let ticking = false;
    function update() {
      ticking = false;
      const content = document.getElementById(contentId);
      if (!content) return;
      // How far the content element has scrolled past the viewport's top
      // edge, as a fraction of its own height: 0 at first contact, 1 once
      // its bottom has reached the top of the viewport.
      const { top, height } = content.getBoundingClientRect();
      const ratio = height > 0 ? -top / height : 0;
      const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
      if (percentRef.current) percentRef.current.textContent = String(percent);
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
  }, [contentId]);

  return (
    <nav aria-label="In this story" className="flex flex-col">
      {sections.map((section) => {
        const active = section.id === activeId;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={[
              "flex items-center gap-3 border-t border-[var(--hairline)] py-2.5 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
              active
                ? "text-[color:var(--foreground)]"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={[
                "h-px shrink-0 bg-[var(--primary)] transition-all duration-[calc(var(--dur-element)*var(--motion-scale))]",
                active ? "w-3.5" : "w-1.5 opacity-50",
              ].join(" ")}
            />
            {section.label}
          </a>
        );
      })}
      <p className="pulse-label mt-5">
        <span ref={percentRef}>0</span>% read
      </p>
    </nav>
  );
}
