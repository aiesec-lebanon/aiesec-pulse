import Link from "next/link";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus } from "@/app/generated/prisma/enums";
import { PageSizeSelect } from "@/components/admin/PageSizeSelect";
import { PostsSearch } from "@/components/admin/PostsSearch";
import { type PostRow, PostsTable } from "@/components/admin/PostsTable";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guards";
import { postScopeWhere, resolveScopeFilter } from "@/lib/rbac/scope-filter";

// Without postScopeWhere this is a cross-entity read of unpublished content.
export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Published", value: "PUBLISHED" },
  { label: "In review", value: "IN_REVIEW" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Hidden", value: "HIDDEN" },
] as const;

function parseStatus(raw: string | undefined): PostStatus | undefined {
  const allowed = [
    "PUBLISHED",
    "IN_REVIEW",
    "REJECTED",
    "HIDDEN",
    "DRAFT",
    "SCHEDULED",
    "ARCHIVED",
  ];
  return raw && allowed.includes(raw) ? (raw as PostStatus) : undefined;
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
  const user = await requirePermission("moderation.hide");
  const scope = await resolveScopeFilter(user, "moderation.hide");

  const params = await searchParams;
  const statusParam = params.status ?? "";
  const status = parseStatus(params.status);
  const q = params.q?.trim() ?? "";
  const limit = clampLimit(params.limit);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const where: Prisma.PostWhereInput = {
    ...postScopeWhere(scope),
    ...(status ? { status } : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { author: { fullName: { contains: q, mode: "insensitive" as const } } },
              ],
            },
          ],
        }
      : {}),
  };

  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        createdAt: true,
        reactionCount: true,
        commentCount: true,
        hiddenReason: true,
        author: { select: { fullName: true } },
        publisher: { select: { name: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const rows: PostRow[] = posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    status: p.status,
    authorName: p.author.fullName,
    authorEntity: p.publisher.name,
    createdAt: p.createdAt.toISOString(),
    reactionCount: p.reactionCount,
    commentCount: p.commentCount,
    hiddenReason: p.hiddenReason,
  }));

  const buildHref = (overrides: Record<string, string | number>) => {
    const next = new URLSearchParams();
    if (statusParam) next.set("status", statusParam);
    if (q) next.set("q", q);
    next.set("limit", String(limit));
    next.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) next.set(k, String(v));
    return `/admin/posts?${next.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
      <h1 className="text-[24px] font-black text-[var(--foreground)]">All posts</h1>
      <p className="mt-1 text-[15px] text-[var(--muted-foreground)]">
        {scope.kind === "all"
          ? "Every post across the network."
          : "Posts published by entities in your moderation scope."}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <nav
          aria-label="Filter by status"
          className="flex flex-wrap gap-1 rounded-[8px] bg-[var(--muted)] p-1"
        >
          {STATUS_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildHref({ status: option.value, page: 1 })}
              aria-current={statusParam === option.value ? "page" : undefined}
              className={[
                "min-h-[28px] rounded-[4px] px-3 py-1 text-[14px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
                statusParam === option.value
                  ? "bg-[var(--card)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {option.label}
            </Link>
          ))}
        </nav>
        <PostsSearch q={q} status={statusParam} limit={limit} />
        <div className="ml-auto">
          <PageSizeSelect current={limit} />
        </div>
      </div>

      <p className="mt-4 text-[13px] text-[var(--muted-foreground)]" role="status">
        {total} {total === 1 ? "post" : "posts"}
      </p>

      <div className="mt-3">
        {rows.length === 0 ? (
          <div className="aiesec-card px-8 py-12 text-center">
            <p className="text-[16px] text-[var(--muted-foreground)]">
              No posts match those filters.
            </p>
          </div>
        ) : (
          <PostsTable rows={rows} />
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4">
          {page > 1 && (
            <Link href={buildHref({ page: page - 1 })} className="aiesec-btn-secondary">
              Previous
            </Link>
          )}
          <span className="text-[14px] tabular-nums text-[var(--muted-foreground)]">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={buildHref({ page: page + 1 })} className="aiesec-btn-secondary">
              Next
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
