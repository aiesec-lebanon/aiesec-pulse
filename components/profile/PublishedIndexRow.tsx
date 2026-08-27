import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import type { TopicKind } from "@/app/generated/prisma/enums";
import { relativeTime } from "@/lib/relative-time";
import { tokensForKind } from "@/lib/topics-shared";

/**
 * One row of 4a's "Published" index: a serif ordinal, the headline in the
 * editorial serif with an arrow that arrives on hover, the topic in its own
 * colour underneath, and the age hard right.
 *
 * The rule at the bottom wipes to brand blue from the left as the pointer
 * lands — the same hover moment the feed's index rows, the search results and
 * the bookmarks list use. One gesture for "this row is a destination", used
 * everywhere a row is one.
 */
export function PublishedIndexRow({
  index,
  href,
  title,
  topic,
  at,
  trailing,
}: {
  index: number;
  href: string;
  title: string;
  topic?: { name: string; kind: TopicKind } | null;
  at: Date;
  /** Anything that replaces the age — a status pill, a scheduled date. */
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative grid grid-cols-[36px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 border-b border-[var(--hairline)] py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:gap-x-6"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-[-1px] h-px origin-left scale-x-0 bg-[var(--primary)] transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:scale-x-100 group-focus-visible:scale-x-100"
      />

      <span
        aria-hidden
        className="pulse-serif text-[26px] leading-none text-[color:var(--muted-foreground)] transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] group-hover:text-[color:var(--primary-text)] sm:text-[28px]"
      >
        {String(index).padStart(2, "0")}
      </span>

      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="pulse-serif break-words text-[22px] leading-[1.2] text-[color:var(--foreground)] sm:text-[25px]">
            {title}
          </span>
          <ArrowUpRight
            size={15}
            strokeWidth={2}
            aria-hidden
            className="mt-1 shrink-0 text-[color:var(--muted-foreground)] opacity-0 transition-[opacity,transform] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:translate-x-[calc(2px*var(--motion-travel))] group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </span>
        {topic && (
          <span
            className="pulse-label mt-2 block"
            style={{ color: tokensForKind(topic.kind).text }}
          >
            {topic.name}
          </span>
        )}
      </span>

      <span className="pulse-label col-start-2 whitespace-nowrap sm:col-start-3 sm:text-right">
        {trailing ?? <time dateTime={at.toISOString()}>{relativeTime(at)}</time>}
      </span>
    </Link>
  );
}
