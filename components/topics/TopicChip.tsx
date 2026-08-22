import Link from "next/link";

import type { TopicKind } from "@/app/generated/prisma/enums";
import { tokensForKind } from "@/lib/topics-shared";

/**
 * Filter chip in display mode: compact, read-only, always the inactive
 * visual — a displayed topic isn't "on" or "off." Links to the topic's
 * archive page, so it gets ordinary link hover/focus treatment on the text
 * rather than the chip's active-state color shift on the container. Coloured
 * by the topic's own kind, like every other topic label in the system —
 * never a hard-coded accent.
 */
export function TopicChip({ slug, name, kind }: { slug: string; name: string; kind: TopicKind }) {
  return (
    <Link
      href={`/topics/${slug}`}
      style={{ color: tokensForKind(kind).text }}
      className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[12px] font-medium transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      {name}
    </Link>
  );
}
