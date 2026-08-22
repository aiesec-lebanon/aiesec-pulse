import { SidebarPostItem } from "@/components/feed/SidebarPostItem";
import type { FeedPost } from "@/types/feed";

/**
 * 1b's closing section: a stat-led serif headline beside a numbered list of
 * headlines, over a scrolling ticker built from the same posts.
 *
 * `weeklyCount` is a real distinct-publisher count (`getWeeklyPublishingStat`
 * in `lib/feed.ts`) — the reference file's "Nine of them are near you" is
 * dropped rather than faked, since nothing here recomputes proximity for a
 * single headline number.
 */
export function ElsewhereSection({
  posts,
  weeklyCount,
}: {
  posts: FeedPost[];
  weeklyCount: number;
}) {
  if (posts.length === 0) return null;

  const tickerItems = posts.map(
    (post) => `${post.author.entityName ?? post.author.fullName} — ${post.title}`
  );

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
            {weeklyCount > 0
              ? `${weeklyCount} ${weeklyCount === 1 ? "entity has" : "entities have"} published this week.`
              : "Quiet across the network this week."}
          </h2>
        </div>

        <div className="flex-1 lg:max-w-[420px]">
          {posts.map((post, i) => (
            <SidebarPostItem key={post.id} post={post} index={i + 1} />
          ))}
        </div>
      </div>

      {tickerItems.length > 0 && (
        <div
          aria-hidden
          className="relative mt-14 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]"
        >
          <div className="pulse-ambient pulse-ticker-track flex w-max gap-9 whitespace-nowrap">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span key={i} className="pulse-label">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
