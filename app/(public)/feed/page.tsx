import { cookies } from "next/headers";

import { FeedModeToggle } from "@/components/feed/FeedModeToggle";
import { HeroPost } from "@/components/feed/HeroPost";
import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
import { SidebarPostItem } from "@/components/feed/SidebarPostItem";
import { TrendingAuthorCard } from "@/components/feed/TrendingAuthorCard";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { getFeedPage, getForYouFeedPage, getTrendingAuthors } from "@/lib/feed";
import { FEED_MODE_COOKIE, parseFeedMode } from "@/lib/feed-mode";
import { isEnabled } from "@/lib/flags";
import { can } from "@/lib/rbac/can";
import { requireSession } from "@/lib/rbac/guards";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireSession();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  // Latest-only, no toggle, when the flag is off — matches how /drafts,
  // /search etc. gate their own entry points (courtesy, not a boundary).
  const rankedAvailable = await isEnabled("feed.ranked");
  const cookieStore = await cookies();
  const mode = rankedAvailable ? parseFeedMode(cookieStore.get(FEED_MODE_COOKIE)?.value) : "latest";

  const [{ posts, hasNext }, trendingAuthors] = await Promise.all([
    mode === "for-you" ? getForYouFeedPage(page) : getFeedPage(page),
    page === 1 ? getTrendingAuthors() : Promise.resolve([]),
  ]);

  const [hero, ...rest] = posts;
  // Density falls as the page descends: one immersive lead, then a row of
  // plates, then quiet index rows. The old order ran cards and rows the other
  // way round, which put the page's flattest block directly under its loudest.
  const cardRow = rest.slice(0, 3);
  const indexRows = rest.slice(3, 6);

  const heading = mode === "for-you" ? "For you" : "Latest";
  const standfirst =
    mode === "for-you"
      ? "Ranked for your entity, your region and what you follow."
      : "Everything published across the network, newest first.";

  if (!hero) {
    return (
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6">
        <FeedHeader
          heading={heading}
          standfirst={standfirst}
          mode={mode}
          rankedAvailable={rankedAvailable}
        />
        <EmptyState
          heading="The feed is quiet — for now."
          body="When entities share updates, they'll appear here. Check back soon."
          action={
            (await can(user, "post.publish"))
              ? { href: "/posts/new", label: "Be the first to post" }
              : undefined
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-24">
      <FeedHeader
        heading={heading}
        standfirst={standfirst}
        mode={mode}
        rankedAvailable={rankedAvailable}
      />

      <section aria-label="Lead story">
        <HeroPost post={hero} />
      </section>

      {cardRow.length > 0 && (
        <section aria-label="More stories" className="mt-20">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cardRow.map((post, i) => (
              <Reveal key={post.id} y={28} delay={i * 80} className="h-full">
                <SecondaryPostCard post={post} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {indexRows.length > 0 && (
        <section aria-labelledby="feed-elsewhere" className="mt-24">
          <h2
            id="feed-elsewhere"
            className="pulse-label mb-2 border-b border-[var(--hairline)] pb-4"
          >
            Elsewhere in the network
          </h2>
          <div className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
            {indexRows.map((post, i) => (
              <Reveal key={post.id} y={20} delay={i * 60}>
                <SidebarPostItem post={post} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {trendingAuthors.length > 0 && (
        <section aria-labelledby="feed-trending" className="mt-24">
          <h2 id="feed-trending" className="pulse-label mb-6">
            Publishing most this month
          </h2>
          {/* Focusable: a scrollable region that cannot be reached by keyboard is
              a 2.1.1 failure, and axe flags it. `tabIndex` plus a name makes the
              strip navigable with arrow keys and announced on entry. */}
          <div
            tabIndex={0}
            role="group"
            aria-label="Authors publishing most this month, scrollable"
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            {trendingAuthors.map((author, i) => (
              <Reveal key={author.id} y={16} x={12} delay={i * 55} className="shrink-0">
                <TrendingAuthorCard author={author} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <Pagination
        label="Feed pagination"
        page={page}
        hasNext={hasNext}
        previousHref={page > 1 ? (page === 2 ? "/feed" : `/feed?page=${page - 1}`) : null}
        nextHref={`/feed?page=${page + 1}`}
      />
    </main>
  );
}

/**
 * The feed's own header. `FeedModeToggle` lives here and nowhere else — the
 * app shell used to carry a second, permanently-active "Latest" tab strip that
 * sat directly above this one, so the page shipped two tab controls a dozen
 * pixels apart with the same label and different meanings.
 */
function FeedHeader({
  heading,
  standfirst,
  mode,
  rankedAvailable,
}: {
  heading: string;
  standfirst: string;
  mode: "latest" | "for-you";
  rankedAvailable: boolean;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pb-8 pt-12 sm:pt-16">
      <Reveal y={16}>
        <h1 className="pulse-display pulse-display-md text-[color:var(--foreground)]">{heading}</h1>
        <p className="mt-3 max-w-[52ch] text-[17px] leading-[1.55] text-[color:var(--muted-foreground)]">
          {standfirst}
        </p>
      </Reveal>

      {rankedAvailable && (
        <Reveal y={16} delay={90}>
          <FeedModeToggle mode={mode} />
        </Reveal>
      )}
    </header>
  );
}
