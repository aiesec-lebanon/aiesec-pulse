import { cookies } from "next/headers";

import { ElsewhereSection } from "@/components/feed/ElsewhereSection";
import { FeedLead } from "@/components/feed/FeedLead";
import { TrendingAuthorCard } from "@/components/feed/TrendingAuthorCard";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { getElsewhereDigest, getFeedPage, getForYouFeedPage, getTrendingAuthors } from "@/lib/feed";
import { FEED_MODE_COOKIE, parseFeedMode } from "@/lib/feed-mode";
import { isEnabled } from "@/lib/flags";
import { can } from "@/lib/rbac/can";
import { requireSession } from "@/lib/rbac/guards";

export default async function FeedPage() {
  const user = await requireSession();

  // Latest-only when the flag is off — a courtesy default, not a permission
  // boundary.
  const rankedAvailable = await isEnabled("feed.ranked");
  const cookieStore = await cookies();
  const mode = rankedAvailable ? parseFeedMode(cookieStore.get(FEED_MODE_COOKIE)?.value) : "latest";

  const [{ posts }, trendingAuthors] = await Promise.all([
    mode === "for-you" ? getForYouFeedPage(1) : getFeedPage(1),
    getTrendingAuthors(),
  ]);

  // Shared pool for hero + "more top stories" rail so FeedLead can split
  // them without ever leaving the rail empty on a quiet (<5 post) day.
  const leadPool = posts.slice(0, 5);

  const heading = mode === "for-you" ? "For you" : "Latest";

  // sr-only, but still required: screen readers need a heading, and
  // e2e/accessibility.spec.ts enforces one h1 per page.
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
              className="flex snap-x snap-mandatory overflow-x-auto pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              {trendingAuthors.map((author, i) => (
                <Reveal key={author.id} y={16} x={12} delay={i * 55} className="shrink-0">
                  <TrendingAuthorCard author={author} isFirst={i === 0} />
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
