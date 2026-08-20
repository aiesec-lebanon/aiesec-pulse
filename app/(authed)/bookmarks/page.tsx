import Link from "next/link";

import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { getBookmarkedPosts } from "@/lib/feed";
import { requireSession } from "@/lib/rbac/guards";

export const metadata = { title: "Bookmarks · AIESEC Pulse" };

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSession();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const { posts, hasNext } = await getBookmarkedPosts(page);

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-24">
      <header className="border-b border-[var(--hairline)] pb-8 pt-12 sm:pt-16">
        <Reveal y={16}>
          <p className="pulse-label">
            <Link
              href="/feed"
              className="pulse-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Feed
            </Link>
            <span aria-hidden className="px-2">
              /
            </span>
            <span className="text-[color:var(--foreground)]">Saved</span>
          </p>
          <h1 className="pulse-display pulse-display-md mt-5 text-[color:var(--foreground)]">
            Bookmarks
          </h1>
          <p className="mt-3 max-w-[52ch] text-[17px] leading-[1.55] text-[color:var(--muted-foreground)]">
            Posts you saved to come back to, newest first.
          </p>
        </Reveal>
      </header>

      {posts.length === 0 && page === 1 ? (
        <EmptyState
          heading="No bookmarks yet."
          body="Save a post from its bookmark icon and it will show up here."
          action={{ href: "/feed", label: "Browse the feed" }}
        />
      ) : (
        <section aria-label="Your bookmarked posts" className="mt-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <Reveal key={post.id} y={28} delay={(i % 3) * 80} className="h-full">
                <SecondaryPostCard post={post} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <Pagination
        label="Bookmarks pagination"
        page={page}
        hasNext={hasNext}
        previousHref={page > 1 ? (page === 2 ? "/bookmarks" : `/bookmarks?page=${page - 1}`) : null}
        nextHref={`/bookmarks?page=${page + 1}`}
      />
    </main>
  );
}
