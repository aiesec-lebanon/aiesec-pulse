import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { EntityName } from "@/components/ui/EntityName";
import { TopicLabel } from "@/components/ui/TopicPill";
import { relativeTime } from "@/lib/relative-time";
import { KIND_LABELS, type SearchHit } from "@/lib/search";

/**
 * A search result's reason for being shown is the matched text, not the cover
 * image — so this stays a text-first row rather than reusing
 * `SecondaryPostCard`.
 *
 * Rendered as a ruled index row instead of a bordered card: a stack of cards
 * gives every result the same weight and the same eight edges, which is what
 * made the old results list read as a wall. The rule wipes to brand blue on
 * hover, the same moment the feed's index rows use.
 */
export function SearchResultRow({ hit }: { hit: SearchHit }) {
  return (
    <article
      role="listitem"
      className="group relative border-b border-[var(--hairline)] py-6 transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] hover:bg-[color-mix(in_srgb,var(--card)_60%,transparent)]"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-[var(--primary)] transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:scale-x-100 group-focus-within:scale-x-100"
      />

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--muted)] px-2 py-0.5 text-[12px] font-medium text-[color:var(--muted-foreground)]">
          {KIND_LABELS[hit.kind]}
        </span>
        {hit.topicName && hit.topicKind && (
          <TopicLabel name={hit.topicName} kind={hit.topicKind} className="text-[10px]" />
        )}
        <span className="pulse-label text-[10px]">
          <span className="normal-case tracking-[0.08em]">
            <EntityName name={hit.entityName} /> · {hit.authorName} ·{" "}
            <time dateTime={hit.publishedAt.toISOString()}>{relativeTime(hit.publishedAt)}</time>
          </span>
        </span>
      </div>

      <h3 className="mt-3 flex items-start gap-2 text-[21px] font-bold leading-[1.25] tracking-[-0.01em] text-[color:var(--foreground)]">
        <Link
          href={`/posts/${hit.slug}`}
          className="block min-h-[26px] transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] after:absolute after:inset-0 after:content-[''] hover:text-[color:var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          {hit.title}
        </Link>
        <ArrowUpRight
          size={18}
          strokeWidth={2}
          aria-hidden
          className="mt-1 shrink-0 text-[color:var(--muted-foreground)] opacity-0 transition-[opacity,transform] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:translate-x-[calc(2px*var(--motion-travel))] group-hover:opacity-100 group-focus-within:opacity-100"
        />
      </h3>

      <p className="mt-2.5 max-w-[72ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
        {hit.snippet.map((part, i) =>
          part.highlighted ? (
            <mark
              key={i}
              className="rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] px-1 py-0.5 font-medium text-[color:var(--primary-text)]"
            >
              {part.text}
            </mark>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </p>
    </article>
  );
}
