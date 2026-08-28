"use client";

import { useEffect, useRef, useState } from "react";

import type { DocumentSection } from "@/lib/content/document";

// Two independent parts: section index needs 2+ H2s; read % always shows.
// % = how much of the article's height has crossed the viewport's middle,
// not raw top/bottom-edge math (undercounts short posts / covers).
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
      const midline = window.innerHeight / 2;
      // Fraction of the article's height crossed past the viewport midline.
      const ratio = (midline - top) / height;
      const clamped = Math.min(1, Math.max(0, ratio));

      const percent = Math.round(clamped * 100);
      if (percentRef.current) percentRef.current.textContent = String(percent);
      // Written straight to the node, not through state — this runs on every
      // scroll frame, and re-rendering React 60x/sec to move one rule is heavy.
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
