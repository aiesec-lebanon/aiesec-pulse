import Link from "next/link";

/**
 * Filter Chips, display mode (§7.4): compact, read-only, always the inactive
 * visual — a displayed topic isn't "on" or "off." Links to the topic's
 * archive page, so it gets ordinary link hover/focus treatment on the text
 * rather than the chip's active-state color shift on the container.
 */
export function TopicChip({ slug, name }: { slug: string; name: string }) {
  return (
    <Link
      href={`/topics/${slug}`}
      className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[12px] font-medium text-[var(--primary-text)] transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      {name}
    </Link>
  );
}
