"use client";

import { useEffect, useRef, useState } from "react";

import type { DocumentSection } from "@/lib/content/document";

/**
 * The sticky reading rail — UI ref 2a.
 *
 * Two parts, now independent — the point of this revision:
 *
 *   - **The section index**, when the story has two or more `H2`s: real
 *     `<a href="#section-N">` anchors — addressable, keyboard-operable, and
 *     cleared of the sticky header via `scroll-mt-24` on each target heading.
 *   - **The read percentage, always.** It used to render *inside* the index
 *     and inherit its gate, so a story with one heading or none — most short
 *     updates — showed no progress at all. Progress isn't a table of
 *     contents; every article has it.
 *
 * Getting there took two wrong versions, both worth recording:
 *
 *   1. `-top / height` reaches 1 only once the article's *bottom* edge has
 *      passed the *top* of the viewport — i.e. once the whole story has scrolled
 *      off screen. A reader looking straight at the last line was told 82%.
 *   2. `(viewportBottom - top) / height` fixed the end and broke the start: it
 *      counts what is *visible*, so an article whose opening third fits on the
 *      first screen reported 33% before the reader had scrolled at all.
 *
 * What "read" actually means is *how far through its own scroll range the
 * article has travelled* — 0 before the reader moves, 1 exactly as the last
 * line reaches the bottom edge. An article shorter than the viewport has no
 * scroll range, so it is read once its last line is on screen.
 */
export function ReadingIndex({
  sections,
  contentId,
}: {
  sections: DocumentSection[];
  /** The id of the article body the read-percentage is measured against. */
  contentId: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const hasIndex = sections.length >= 2;

  useEffect(() => {
    if (!hasIndex) return;
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
  }, [sections, hasIndex]);

  useEffect(() => {
    let ticking = false;

    function update() {
      ticking = false;
      const content = document.getElementById(contentId);
      if (!content) return;

      const { top, height } = content.getBoundingClientRect();
      const viewport = window.innerHeight;
      // How far the article can travel before its last line reaches the bottom
      // edge. Negative when the whole article already fits on one screen.
      const range = height - viewport;
      const ratio = range > 0 ? -top / range : top + height <= viewport ? 1 : 0;
      const clamped = Math.min(1, Math.max(0, ratio));

      const percent = Math.round(clamped * 100);
      if (percentRef.current) percentRef.current.textContent = String(percent);
      // Written straight to the node rather than through state: this runs on
      // every scroll frame, and re-rendering a React tree sixty times a
      // second to move one rule is what makes a page feel heavy.
      if (barRef.current) barRef.current.style.transform = `scaleX(${clamped})`;
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
    <div className="flex flex-col">
      {hasIndex && (
        <>
          <p className="pulse-label pulse-label-wide mb-4">In this story</p>
          <nav aria-label="In this story" className="mb-6 flex flex-col">
            {sections.map((section) => {
              const active = section.id === activeId;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className={[
                    "flex items-center gap-3 border-t border-[var(--hairline)] py-2.5 text-[12.5px] font-bold leading-[1.35] transition-colors last:border-b focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
                    active
                      ? "text-[color:var(--foreground)]"
                      : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={[
                      "h-px shrink-0 transition-all duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]",
                      active ? "w-3.5 bg-[var(--primary)]" : "w-1.5 bg-[var(--border)]",
                    ].join(" ")}
                  />
                  {section.label}
                </a>
              );
            })}
          </nav>
        </>
      )}

      {/* Always. A rule that fills as the reader descends, and the figure
          beside it — the same information twice, because the rule is read at a
          glance and the figure is read when you look. */}
      <p className="pulse-label">
        <span ref={percentRef}>0</span>% read
      </p>
      <span aria-hidden className="mt-2 block h-px w-full overflow-hidden bg-[var(--hairline)]">
        <span
          ref={barRef}
          className="block h-full origin-left bg-[var(--primary)] transition-transform duration-[calc(120ms*var(--motion-scale))] ease-out"
          style={{ transform: "scaleX(0)" }}
        />
      </span>
    </div>
  );
}
