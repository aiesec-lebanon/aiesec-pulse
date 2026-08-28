import { cookies } from "next/headers";

import { ElsewhereSection } from "@/components/feed/ElsewhereSection";
import { FeedLead } from "@/components/feed/FeedLead";
import { TrendingAuthorCard } from "@/components/feed/TrendingAuthorCard";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { getElsewhereDigest, getFeedPage, getForYouFeedPage, getTrendingAuthors } from "@/lib/feed";
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

  // Latest-only when the flag is off — a courtesy default, not a permission
  // boundary.
  const rankedAvailable = await isEnabled("feed.ranked");
  const cookieStore = await cookies();
  const mode = rankedAvailable ? parseFeedMode(cookieStore.get(FEED_MODE_COOKIE)?.value) : "latest";

  const [{ posts, hasNext }, trendingAuthors] = await Promise.all([
    mode === "for-you" ? getForYouFeedPage(page) : getFeedPage(page),
    page === 1 ? getTrendingAuthors() : Promise.resolve([]),
  ]);

  // One shared pool feeds both the hero and the "more top stories" rail —
  // FeedLead decides which post is which, so a quiet day (fewer than five
  // posts) never leaves the rail empty the way two disjoint slices used to.
  const leadPool = posts.slice(0, 5);

  const heading = mode === "for-you" ? "For you" : "Latest";

  // Visually hidden, but a heading still has to exist for a screen-reader
  // user landing on the route, and for the one-h1-per-page contract
  // e2e/accessibility.spec.ts checks.
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

  // Its own query, not the next slice of this page — see `getElsewhereDigest`
  // — so its headline count and rows describe the same time window.
  const elsewhere = await getElsewhereDigest(leadPool.map((post) => post.id));

  return (
    <main className="flex-1 pb-24">
      {pageHeading}

      {/* FeedLead renders the hero and the overlapping rail together — they
          share `active` state. */}
      <FeedLead posts={leadPool} />

      <div className="mx-auto w-full max-w-[1240px] px-6">
        <ElsewhereSection
          posts={elsewhere.posts}
          entityCount={elsewhere.entityCount}
          window={elsewhere.window}
        />

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
