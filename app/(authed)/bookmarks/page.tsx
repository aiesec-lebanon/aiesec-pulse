import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { FeedIllustration } from "@/components/feed/FeedIllustration";
import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
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
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10">
      <Link
        href="/feed"
        className="mb-6 inline-flex min-h-[24px] items-center gap-1.5 rounded-[var(--radius-sm)] text-[14px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Back to feed
      </Link>

      <h1 className="text-[32px] font-black leading-[1.1] tracking-tight text-[var(--foreground)]">
        Bookmarks
      </h1>

      {posts.length === 0 && page === 1 ? (
        <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-6 text-center">
          <div
            className="text-[var(--muted-foreground)] opacity-60 animate-float-drift"
            aria-hidden="true"
          >
            <FeedIllustration className="h-auto w-36" />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-[20px] font-bold text-[var(--foreground)]">No bookmarks yet.</h2>
            <p className="text-[16px] leading-[1.6] text-[var(--muted-foreground)]">
              Save a post from its bookmark icon and it will show up here.
            </p>
          </div>
          <Link href="/feed" className="aiesec-btn-primary">
            Browse the feed
          </Link>
        </div>
      ) : (
        <section aria-label="Your bookmarked posts" className="mt-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <SecondaryPostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {(posts.length > 0 || page > 1) && (
        <nav
          aria-label="Bookmarks pagination"
          className="mt-12 flex items-center justify-center gap-4"
        >
          {page > 1 && (
            <a
              href={page === 2 ? "/bookmarks" : `/bookmarks?page=${page - 1}`}
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-[15px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              <span aria-hidden>←</span> Newer
            </a>
          )}
          {posts.length > 0 && (
            <span className="select-none text-[14px] tabular-nums text-[var(--muted-foreground)]">
              Page {page}
            </span>
          )}
          {hasNext && (
            <a
              href={`/bookmarks?page=${page + 1}`}
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-[15px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Older <span aria-hidden>→</span>
            </a>
          )}
        </nav>
      )}
    </main>
  );
}
