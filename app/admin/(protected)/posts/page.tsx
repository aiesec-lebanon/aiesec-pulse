import Link from "next/link";
import { db } from "@/lib/db";
import { PostStatus } from "@/app/generated/prisma/enums";
import { PostsTable } from "@/components/admin/PostsTable";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Pending", value: "PENDING" },
  { label: "Rejected", value: "REJECTED" },
] as const;

function parseStatus(raw: string | undefined): PostStatus | undefined {
  if (raw === "PUBLISHED") return PostStatus.PUBLISHED;
  if (raw === "PENDING") return PostStatus.PENDING;
  if (raw === "REJECTED") return PostStatus.REJECTED;
  return undefined;
}

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const statusParam = params.status ?? "";
  const page = Math.max(1, Number.isNaN(parseInt(params.page ?? "1", 10)) ? 1 : parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where = status ? { status } : {};

  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        author: {
          select: { fullName: true, committeeName: true },
        },
        _count: { select: { likes: true, comments: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows = posts.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    authorName: p.author.fullName,
    authorEntity: p.author.committeeName ?? "",
    createdAt: relativeTime(p.createdAt),
    likeCount: p._count.likes,
    commentCount: p._count.comments,
  }));

  function pageHref(p: number) {
    const q = new URLSearchParams();
    if (statusParam) q.set("status", statusParam);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return `/admin/posts${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
      <h1 className="text-[20px] font-bold text-[var(--foreground)] mb-6">
        All Posts
        <span className="ml-3 text-[16px] font-normal text-[var(--muted-foreground)] tabular-nums">
          {total}
        </span>
      </h1>

      {/* Filter chips — §7.4 */}
      <div
        className="flex flex-wrap gap-2 mb-6"
        role="group"
        aria-label="Filter posts by status"
      >
        {FILTER_OPTIONS.map(({ label, value }) => {
          const isActive = statusParam === value;
          return (
            <Link
              key={value}
              href={value ? `/admin/posts?status=${value}` : "/admin/posts"}
              className={[
                "px-3 py-1.5 rounded-[var(--radius-md)] border text-[14px] font-medium transition-colors",
                isActive
                  ? "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] border-[var(--primary)] text-[var(--primary)]"
                  : "bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="text-[16px] text-[var(--muted-foreground)] py-16 text-center">
          No posts found.
        </p>
      ) : (
        <PostsTable rows={rows} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          className="flex items-center justify-center gap-2 mt-8"
          aria-label="Pagination"
        >
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
              className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[14px] font-medium text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="text-[14px] text-[var(--muted-foreground)] px-2 tabular-nums">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={pageHref(page + 1)}
              className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[14px] font-medium text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
