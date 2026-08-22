import { cookies } from "next/headers";

import { ElsewhereSection } from "@/components/feed/ElsewhereSection";
import { FeedLead } from "@/components/feed/FeedLead";
import { TrendingAuthorCard } from "@/components/feed/TrendingAuthorCard";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import {
  getFeedPage,
  getForYouFeedPage,
  getTrendingAuthors,
  getWeeklyPublishingStat,
} from "@/lib/feed";
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

  const [{ posts, hasNext }, trendingAuthors, weeklyCount] = await Promise.all([
    mode === "for-you" ? getForYouFeedPage(page) : getFeedPage(page),
    page === 1 ? getTrendingAuthors() : Promise.resolve([]),
    getWeeklyPublishingStat(),
  ]);

  // One shared pool of up to five posts feeds the whole lead complex: one is
  // in the hero at a time, the other four fill the "also today" rail —
  // FeedLead owns which is which and re-shuffles the rail as the hero
  // rotates, so a quiet day (fewer than five posts) never leaves the rail
  // empty the way two disjoint slices used to.
  const leadPool = posts.slice(0, 5);
  const elsewhere = posts.slice(5, 8);

  const heading = mode === "for-you" ? "For you" : "Latest";

  // The page's h1 — visually hidden. The reference file's own header is the
  // shell's nav bar; there is no separate "For you" title-and-standfirst
  // block beneath it, the rotator is the page's visual lead. A heading still
  // has to exist for a screen-reader user landing on the route, and for the
  // one-h1-per-page contract e2e/accessibility.spec.ts already checks — it
  // just carries no visual weight of its own any more.
  const pageHeading = <h1 className="sr-only">{heading}</h1>;

  if (leadPool.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6">
        {pageHeading}
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
    <main className="flex-1 pb-24">
      {pageHeading}

      {/* Full-bleed hero, then the "also today" rail in the reading column —
          FeedLead splits the two internally since they share `active`. */}
      <FeedLead posts={leadPool} />

      <div className="mx-auto w-full max-w-[1240px] px-6">
        <ElsewhereSection posts={elsewhere} weeklyCount={weeklyCount} />

        {trendingAuthors.length > 0 && (
          <section aria-labelledby="feed-trending" className="mt-24">
            <h2 id="feed-trending" className="pulse-label mb-6">
              Publishing most this month
            </h2>
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
      </div>
    </main>
  );
}
