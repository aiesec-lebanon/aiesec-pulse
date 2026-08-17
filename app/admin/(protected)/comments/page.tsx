import Link from "next/link";

import type { Prisma } from "@/app/generated/prisma/client";
import { type CommentRow, CommentsTable } from "@/components/admin/CommentsTable";
import { PageSizeSelect } from "@/components/admin/PageSizeSelect";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guards";
import { commentScopeWhere, resolveScopeFilter } from "@/lib/rbac/scope-filter";

export const dynamic = "force-dynamic";

const VIEW_OPTIONS = [
  { label: "All", value: "" },
  { label: "Visible", value: "VISIBLE" },
  { label: "Hidden", value: "HIDDEN" },
  { label: "Deleted by author", value: "DELETED" },
] as const;

function clampLimit(raw: string | undefined): number {
  const n = parseInt(raw ?? "25", 10);
  return [10, 25, 50, 100].includes(n) ? n : 25;
}

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string; limit?: string }>;
}) {
  const user = await requirePermission("moderation.hide");
  const scope = await resolveScopeFilter(user, "moderation.hide");

  const params = await searchParams;
  const view = VIEW_OPTIONS.some((o) => o.value === params.view) ? (params.view ?? "") : "";
  const limit = clampLimit(params.limit);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const where: Prisma.CommentWhereInput = {
    ...commentScopeWhere(scope),
    ...(view ? { status: view as "VISIBLE" | "HIDDEN" | "DELETED" } : {}),
  };

  const [total, comments] = await Promise.all([
    db.comment.count({ where }),
    db.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        body: true,
        status: true,
        hiddenReason: true,
        createdAt: true,
        user: { select: { fullName: true, primaryEntity: { select: { name: true } } } },
        post: { select: { slug: true, title: true } },
      },
    }),
  ]);

  const rows: CommentRow[] = comments.map((c) => ({
    id: c.id,
    body: c.body,
    status: c.status,
    hiddenReason: c.hiddenReason,
    createdAt: c.createdAt.toISOString(),
    authorName: c.user.fullName,
    authorEntity: c.user.primaryEntity?.name ?? null,
    postSlug: c.post.slug,
    postTitle: c.post.title,
  }));

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const buildHref = (overrides: Record<string, string | number>) => {
    const next = new URLSearchParams();
    if (view) next.set("view", view);
    next.set("limit", String(limit));
    next.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) next.set(k, String(v));
    return `/admin/comments?${next.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
      <h1 className="text-[24px] font-black text-[var(--foreground)]">Comments</h1>
      <p className="mt-1 text-[15px] text-[var(--muted-foreground)]">
        Hiding is reversible and always carries a reason the author can see.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <nav
          aria-label="Filter comments"
          className="flex flex-wrap gap-1 rounded-[8px] bg-[var(--muted)] p-1"
        >
          {VIEW_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildHref({ view: option.value, page: 1 })}
              aria-current={view === option.value ? "page" : undefined}
              className={[
                "min-h-[28px] rounded-[4px] px-3 py-1 text-[14px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
                view === option.value
                  ? "bg-[var(--card)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {option.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <PageSizeSelect current={limit} />
        </div>
      </div>

      <p className="mt-4 text-[13px] text-[var(--muted-foreground)]" role="status">
        {total} {total === 1 ? "comment" : "comments"}
      </p>

      <div className="mt-3">
        {rows.length === 0 ? (
          <div className="aiesec-card px-8 py-12 text-center">
            <p className="text-[16px] text-[var(--muted-foreground)]">
              No comments match that filter.
            </p>
          </div>
        ) : (
          <CommentsTable rows={rows} />
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
