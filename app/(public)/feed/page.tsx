import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { PostStatus, UserRole } from "@/app/generated/prisma/enums";
import { HeroPost } from "@/components/feed/HeroPost";
import { SidebarPostItem } from "@/components/feed/SidebarPostItem";
import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
import { TrendingAuthorCard } from "@/components/feed/TrendingAuthorCard";
import { FeedEmptyState } from "@/components/feed/FeedEmptyState";

// ── Constants ─────────────────────────────────────────────────────────────────

const POSTS_PER_PAGE = 7; // 1 hero + 3 sidebar + 3 secondary

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getFeedPosts(page: number) {
  const skip = (page - 1) * POSTS_PER_PAGE;
  // Fetch one extra to detect whether a next page exists.
  const rows = await db.post.findMany({
    where: { status: PostStatus.PUBLISHED },
    orderBy: { createdAt: "desc" },
    skip,
    take: POSTS_PER_PAGE + 1,
    include: {
      author: true,
      _count: { select: { likes: true, comments: true } },
    },
  });
  const hasNext = rows.length > POSTS_PER_PAGE;
  return { posts: rows.slice(0, POSTS_PER_PAGE), hasNext };
}

async function getTrendingAuthors() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const grouped = await db.post.groupBy({
    by: ["authorId"],
    where: {
      status: PostStatus.PUBLISHED,
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 8,
  });

  if (grouped.length === 0) return [];

  const authorIds = grouped.map((r) => r.authorId);
  const authors = await db.user.findMany({ where: { id: { in: authorIds } } });

  return grouped
    .map((r) => {
      const author = authors.find((a) => a.id === r.authorId);
      if (!author) return null;
      return { ...author, postCount: r._count.id };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [{ posts, hasNext }, trendingAuthors] = await Promise.all([
    getFeedPosts(page),
    page === 1 ? getTrendingAuthors() : Promise.resolve([]),
  ]);

  const [hero, ...rest] = posts;
  const sidebar = rest.slice(0, 3);
  const secondaryRow = rest.slice(3, 6);

  // ── DEV STUB: uncomment one line below to preview a state, remove before ship ──
  // if (true) return <FeedEmptyState isMCP={user.role === UserRole.MCP} />;
  // if (true) throw new Error("Force error for testing");

  if (!hero) {
    return <FeedEmptyState isMCP={user.role === UserRole.MCP} />;
  }

  return (
    <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-10">

      {/* ── PRIMARY ROW — 8/12 hero + 4/12 sidebar ──────────────────────── */}
      <section aria-label="Featured story">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">

          {/* LEFT — hero */}
          <div className="lg:col-span-8">
            <HeroPost post={hero} />
          </div>

          {/* RIGHT — stacked secondary previews
              Mobile:  single-column list
              Tablet:  2-column grid (below hero in DOM flow)
              Desktop: 1-column stack beside hero */}
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

      {/* ── SECONDARY ROW — 3-card horizontal strip, 32px below ─────────── */}
      {secondaryRow.length > 0 && (
        <section aria-label="More stories" className="mt-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {secondaryRow.map((post) => (
              <SecondaryPostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* ── TRENDING AUTHORS — page 1 only ──────────────────────────────── */}
      {trendingAuthors.length > 0 && (
        <section aria-label="Trending authors this month" className="mt-12">
          <h2 className="mb-4 text-[16px] font-bold text-[var(--foreground)]">
            Trending this month
          </h2>
          <div
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3
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

      {/* ── PAGINATION ───────────────────────────────────────────────────── */}
      <nav
        aria-label="Feed pagination"
        className="mt-12 flex items-center justify-center gap-4"
      >
        {page > 1 && (
          <a
            href={page === 2 ? "/feed" : `/feed?page=${page - 1}`}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-[15px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            ← Newer
          </a>
        )}
        <span className="text-[14px] text-[var(--muted-foreground)] tabular-nums select-none">
          Page {page}
        </span>
        {hasNext && (
          <a
            href={`/feed?page=${page + 1}`}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-[15px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            Older →
          </a>
        )}
      </nav>
    </main>
  );
}
