import Link from "next/link";
import { db } from "@/lib/db";
import { PostStatus } from "@/app/generated/prisma/enums";
import { PostsTable } from "@/components/admin/PostsTable";
import { PostsSearch } from "@/components/admin/PostsSearch";
import { PageSizeSelect } from "@/components/admin/PageSizeSelect";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
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

function clampLimit(raw: string | undefined): number {
  const n = parseInt(raw ?? "25", 10);
  return [10, 25, 50, 100].includes(n) ? n : 25;
}

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const statusParam = params.status ?? "";
  const status = parseStatus(params.status);
  const q = params.q?.trim() ?? "";
  const limit = clampLimit(params.limit);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const skip = (page - 1) * limit;

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { author: { fullName: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        author: { select: { fullName: true, committeeName: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

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
    const qp = new URLSearchParams();
    if (statusParam) qp.set("status", statusParam);
    if (q) qp.set("q", q);
    if (limit !== 25) qp.set("limit", String(limit));
    if (p > 1) qp.set("page", String(p));
    const qs = qp.toString();
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

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Status chips */}
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter posts by status"
        >
          {STATUS_OPTIONS.map(({ label, value }) => {
            const isActive = statusParam === value;
            const href = value
              ? `/admin/posts?status=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}${limit !== 25 ? `&limit=${limit}` : ""}`
              : `/admin/posts${q ? `?q=${encodeURIComponent(q)}` : ""}${limit !== 25 ? `${q ? "&" : "?"}limit=${limit}` : ""}`;
            return (
              <Link
                key={value}
                href={href}
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

        {/* Search */}
        <PostsSearch q={q} status={statusParam} limit={limit} />
      </div>

      {rows.length === 0 ? (
        <p className="text-[16px] text-[var(--muted-foreground)] py-16 text-center">
          No posts found.
        </p>
      ) : (
        <PostsTable rows={rows} />
      )}

      {/* Pagination + page size */}
      <div className="flex items-center justify-between mt-8 gap-4 flex-wrap">
        <PageSizeSelect current={limit} />
        {totalPages > 1 && (
          <nav className="flex items-center gap-2" aria-label="Pagination">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[14px] font-medium text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
              >
                ← Previous
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
                Next →
              </Link>
            )}
          </nav>
        )}
      </div>
    </main>
  );
}
