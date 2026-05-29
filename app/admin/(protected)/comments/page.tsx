import Link from "next/link";
import { db } from "@/lib/db";
import { relativeTime } from "@/lib/relative-time";
import { CommentsFilterRow } from "@/components/admin/CommentsFilterRow";
import { CommentsTable } from "@/components/admin/CommentsTable";
import { PageSizeSelect } from "@/components/admin/PageSizeSelect";
import type { CommentRow } from "@/components/admin/CommentsTable";

export const dynamic = "force-dynamic";

function parsePostRef(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/posts\/([^/?#\s]+)/);
  if (match) return match[1];
  return trimmed;
}

function clampLimit(raw: string | undefined): number {
  const n = parseInt(raw ?? "25", 10);
  return [10, 25, 50, 100].includes(n) ? n : 25;
}

type DeletedMode = "" | "active" | "removed";

function parseDeleted(raw: string | undefined): DeletedMode {
  if (raw === "active" || raw === "removed") return raw;
  return "";
}

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    postId?: string;
    deleted?: string;
    limit?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const isPostMode = params.filter === "post" && !!params.postId;
  const resolvedPostId = isPostMode ? parsePostRef(params.postId ?? "") : "";
  const deleted = parseDeleted(params.deleted);
  const limit = clampLimit(params.limit);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const skip = (page - 1) * limit;

  const deletedWhere =
    deleted === "active"
      ? { deletedAt: null }
      : deleted === "removed"
      ? { deletedAt: { not: null } }
      : {};

  const where = {
    ...(isPostMode && resolvedPostId ? { postId: resolvedPostId } : {}),
    ...deletedWhere,
  };

  const [total, comments] = await Promise.all([
    db.comment.count({ where }),
    db.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        content: true,
        deletedAt: true,
        createdAt: true,
        user: { select: { fullName: true, committeeName: true } },
        post: { select: { id: true, title: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const rows: CommentRow[] = comments.map((c) => ({
    id: c.id,
    content: c.content,
    tombstone: c.deletedAt !== null,
    createdAt: relativeTime(c.createdAt),
    authorName: c.user?.fullName ?? "(unknown)",
    authorEntity: c.user?.committeeName ?? null,
    postId: c.post.id,
    postTitle: c.post.title,
  }));

  function pageHref(p: number) {
    const q = new URLSearchParams();
    if (isPostMode && resolvedPostId) {
      q.set("filter", "post");
      q.set("postId", resolvedPostId);
    }
    if (deleted) q.set("deleted", deleted);
    if (limit !== 25) q.set("limit", String(limit));
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return `/admin/comments${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
      <h1 className="text-[20px] font-bold text-[var(--foreground)] mb-6">
        Comments
        <span className="ml-3 text-[16px] font-normal text-[var(--muted-foreground)] tabular-nums">
          {total}
        </span>
      </h1>

      <div className="flex flex-col gap-3 mb-6">
        {/* Existing post filter */}
        <CommentsFilterRow
          mode={isPostMode ? "post" : "recent"}
          postId={resolvedPostId}
          deleted={deleted}
          limit={limit}
        />

        {/* Deleted status chips */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by comment status">
          {(
            [
              { label: "All", value: "" },
              { label: "Active", value: "active" },
              { label: "Removed", value: "removed" },
            ] as const
          ).map(({ label, value }) => {
            const isActive = deleted === value;
            const params = new URLSearchParams();
            if (isPostMode && resolvedPostId) {
              params.set("filter", "post");
              params.set("postId", resolvedPostId);
            }
            if (value) params.set("deleted", value);
            if (limit !== 25) params.set("limit", String(limit));
            const qs = params.toString();
            return (
              <Link
                key={value}
                href={`/admin/comments${qs ? `?${qs}` : ""}`}
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
      </div>

      {rows.length === 0 ? (
        <p className="text-[16px] text-[var(--muted-foreground)] py-16 text-center">
          No comments found.
        </p>
      ) : (
        <CommentsTable rows={rows} />
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
