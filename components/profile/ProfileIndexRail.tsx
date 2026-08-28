"use client";

import { useEffect, useState } from "react";

export type ProfileSection = { id: string; label: string };

/**
 * The sticky "on this profile" rail — 4a's left column.
 *
 * Deliberately the same device as the story page's `ReadingIndex` (down to the
 * growing tick), so the two rails read as one product. A separate component
 * because it tracks named sections, not headings, and has no read-percentage —
 * a profile isn't something a reader finishes.
 *
 * Real `<a href="#id">` anchors for addressability and keyboard operation;
 * `scroll-mt-*` on each target clears the sticky header.
 */
export function ProfileIndexRail({
  sections,
  label = "On this profile",
}: {
  sections: ProfileSection[];
  label?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-12% 0px -76% 0px", threshold: 0 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <nav aria-label={label} className="flex flex-col">
      <p className="pulse-label pulse-label-wide mb-4">{label}</p>
      {sections.map((section) => {
        const active = section.id === activeId;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={active ? "true" : undefined}
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
  );
}
