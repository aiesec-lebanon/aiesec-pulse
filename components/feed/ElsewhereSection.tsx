import { SidebarPostItem } from "@/components/feed/SidebarPostItem";
import type { ElsewhereWindow } from "@/lib/feed";
import type { FeedPost } from "@/types/feed";

/**
 * 1b's closing section: a stat-led serif headline beside a numbered list of
 * headlines, over a scrolling ticker built from the same posts.
 *
 * The headline and list now share one query (`getElsewhereDigest`) describing
 * one window. They used to be independent — a seven-day publisher count over
 * whatever came next in the feed — putting "1 entity has published this week"
 * above a story from three months earlier. A stat that doesn't describe what's
 * under it is worse than no stat (§0.8).
 */

const WINDOW_PHRASE: Record<ElsewhereWindow, string> = {
  week: "this week",
  month: "this month",
  all: "so far",
};

/** Enough entries that the marquee reaches both edges of its own track. */
const MIN_TICKER_ENTRIES = 8;

export function ElsewhereSection({
  posts,
  entityCount,
  window,
}: {
  posts: FeedPost[];
  entityCount: number;
  window: ElsewhereWindow;
}) {
  if (posts.length === 0) return null;

  const entries = posts.map(
    (post) => `${post.author.entityName ?? post.author.fullName} — ${post.title}`
  );

  // One duplicate of a two-item list is still a two-item list: at ~600px on a
  // 1240px page, the marquee started halfway across, leaving the left half of
  // the section blank. The set repeats until it fills a track, *then* doubles
  // for the seamless -50% loop.
  const repeats = Math.max(1, Math.ceil(MIN_TICKER_ENTRIES / entries.length));
  const track = Array.from({ length: repeats }, () => entries).flat();

  return (
    <section
      aria-labelledby="feed-elsewhere-heading"
      className="relative mt-24 overflow-hidden border-t border-[var(--hairline)] pb-4 pt-16"
    >
      {/* Decorative — z-indexed under the type, over nothing but the page
          ground, matching the reference file's 4-col overlay device. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-4">
        <span className="border-r border-[var(--hairline)]" />
        <span className="border-r border-[var(--hairline)]" />
        <span className="border-r border-[var(--hairline)]" />
        <span />
      </div>

      <div className="relative flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
        <div className="max-w-[44ch]">
          <p className="pulse-label pulse-label-wide mb-4">Elsewhere in the network</p>
          <h2
            id="feed-elsewhere-heading"
            className="pulse-serif pulse-serif-md pulse-balance text-[color:var(--foreground)]"
          >
            {entityCount > 0
              ? `${entityCount} ${entityCount === 1 ? "entity has" : "entities have"} published ${WINDOW_PHRASE[window]}.`
              : "Quiet across the network."}
          </h2>
        </div>

        <div className="flex-1 lg:max-w-[420px]">
          {posts.map((post, i) => (
            <SidebarPostItem key={post.id} post={post} index={i + 1} />
          ))}
        </div>
      </div>

      {/* Pulled out to the container's own edges: a marquee that stops short
          of the page margin reads as a broken element rather than as a rule
          running under the section. */}
      <div
        aria-hidden
        className="relative -mx-6 mt-14 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]"
      >
        <div className="pulse-ambient pulse-ticker-track flex w-max gap-9 whitespace-nowrap px-6">
          {[...track, ...track].map((entry, i) => (
            <span key={i} className="pulse-label pulse-label-wide">
              {entry}
            </span>
          ))}
        </div>
      </div>

      {/* The ticker is `aria-hidden`, so the entities it names are announced
          once, here, in the register a screen reader can actually use. */}
      <p className="sr-only">
        Also publishing:{" "}
        {posts
          .map((post) => post.author.entityName ?? post.author.fullName)
          .filter((name, i, all) => all.indexOf(name) === i)
          .join(", ")}
        .
      </p>
    </section>
  );
}
