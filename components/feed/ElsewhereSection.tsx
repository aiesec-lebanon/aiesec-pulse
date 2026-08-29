import { SidebarPostItem } from "@/components/feed/SidebarPostItem";
import type { ElsewhereWindow } from "@/lib/feed";
import type { FeedPost } from "@/types/feed";

/**
 * The feed's closing section — stat headline, numbered list, and ticker,
 * all from one window (`getElsewhereDigest`). Keep them on the same query:
 * the stat must describe the posts under it, not an unrelated window.
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

  // Repeat entries until they fill a full track, then double that set for
  // a seamless -50% loop — too few repeats starts the marquee mid-track,
  // leaving blank space on one side.
  const repeats = Math.max(1, Math.ceil(MIN_TICKER_ENTRIES / entries.length));
  const track = Array.from({ length: repeats }, () => entries).flat();

  return (
    <section
      aria-labelledby="feed-elsewhere-heading"
      className="relative mt-24 overflow-hidden border-t border-[var(--hairline)] pb-4 pt-16"
    >
      {/* Decorative. */}
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

      {/* Ticker is aria-hidden; this is the one place screen readers hear these entity names. */}
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
