import Link from "next/link";

import type { TopicKind } from "@/app/generated/prisma/enums";
import { tokensForKind } from "@/lib/topics-shared";

/**
 * Read-only display of a topic, not a toggleable filter like `TopicPicker`'s
 * chip — no active/pressed state or `aria-pressed`. Coloured by the topic's
 * own kind, never a hard-coded accent.
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
