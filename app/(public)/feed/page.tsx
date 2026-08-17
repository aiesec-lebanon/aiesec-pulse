import { FeedEmptyState } from "@/components/feed/FeedEmptyState";
import { HeroPost } from "@/components/feed/HeroPost";
import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
import { SidebarPostItem } from "@/components/feed/SidebarPostItem";
import { TrendingAuthorCard } from "@/components/feed/TrendingAuthorCard";
import { getFeedPage, getTrendingAuthors } from "@/lib/feed";
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

  const [{ posts, hasNext }, trendingAuthors] = await Promise.all([
    getFeedPage(page),
    page === 1 ? getTrendingAuthors() : Promise.resolve([]),
  ]);

  const [hero, ...rest] = posts;
  const sidebar = rest.slice(0, 3);
  const secondaryRow = rest.slice(3, 6);

  if (!hero) {
    return <FeedEmptyState canPublish={await can(user, "post.publish")} />;
  }

  return (
    <main className="w-full max-w-[1200px] flex-1 mx-auto px-6 py-10">
      <h1 className="sr-only">Latest across the AIESEC network</h1>

      <section aria-label="Featured story">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <HeroPost post={hero} />
          </div>

          {/* Mobile: single column · Tablet: 2-up below the hero · Desktop: stacked beside it */}
          {sidebar.length > 0 && (
            <div
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1"
              aria-label="More recent stories"
            >
              {sidebar.map((post) => (
                <SidebarPostItem key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>

      {secondaryRow.length > 0 && (
        <section aria-label="More stories" className="mt-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {secondaryRow.map((post) => (
              <SecondaryPostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {trendingAuthors.length > 0 && (
        <section aria-label="Trending authors this month" className="mt-12">
          <h2 className="mb-4 text-[16px] font-bold text-[var(--foreground)]">
            Trending this month
          </h2>
          {/* Focusable: a scrollable region that cannot be reached by keyboard is
              a 2.1.1 failure, and axe flags it. `tabIndex` plus a name makes the
              strip navigable with arrow keys and announced on entry. */}
          <div
            tabIndex={0}
            role="group"
            aria-label="Trending authors, scrollable"
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]
              [&::-webkit-scrollbar]:h-1.5
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-[var(--border)]"
          >
            {trendingAuthors.map((author) => (
              <TrendingAuthorCard key={author.id} author={author} />
            ))}
          </div>
        </section>
      )}

      <nav aria-label="Feed pagination" className="mt-12 flex items-center justify-center gap-4">
        {page > 1 && (
          <a
            href={page === 2 ? "/feed" : `/feed?page=${page - 1}`}
            className="min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-[15px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            <span aria-hidden>←</span> Newer
          </a>
        )}
        <span className="select-none text-[14px] tabular-nums text-[var(--muted-foreground)]">
          Page {page}
        </span>
        {hasNext && (
          <a
            href={`/feed?page=${page + 1}`}
            className="min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-[15px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            Older <span aria-hidden>→</span>
          </a>
        )}
      </nav>
    </main>
  );
}
