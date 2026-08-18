import Link from "next/link";

import { relativeTime } from "@/lib/relative-time";
import { KIND_LABELS, type SearchHit } from "@/lib/search";

// List row (§10.10's row shape: .aiesec-card, flex, gap-3, p-4) rather than
// SecondaryPostCard's image-first card — a search result's reason for being
// shown is the matched text, not the cover image, so the snippet needs to be
// the visually dominant element.
export function SearchResultRow({ hit }: { hit: SearchHit }) {
  return (
    <article role="listitem" className="aiesec-card flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[var(--radius-md)] bg-[var(--muted)] px-2 py-0.5 text-[12px] font-medium text-[var(--muted-foreground)]">
          {KIND_LABELS[hit.kind]}
        </span>
        <span className="text-[13px] text-[var(--muted-foreground)]">
          {hit.entityName} · {hit.authorName} ·{" "}
          <time dateTime={hit.publishedAt.toISOString()}>{relativeTime(hit.publishedAt)}</time>
        </span>
      </div>

      <Link
        href={`/posts/${hit.slug}`}
        className="text-[20px] font-bold leading-tight text-[var(--card-foreground)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        {hit.title}
      </Link>

      <p className="text-[15px] leading-[1.6] text-[var(--muted-foreground)]">
        {hit.snippet.map((part, i) =>
          part.highlighted ? (
            <mark
              key={i}
              className="rounded-[2px] bg-[var(--primary)]/10 px-0.5 text-[var(--primary-text)]"
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
