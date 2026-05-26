import Link from "next/link";
import { db } from "@/lib/db";
import { relativeTime } from "@/lib/relative-time";
import { CommentsFilterRow } from "@/components/admin/CommentsFilterRow";
import { CommentsTable } from "@/components/admin/CommentsTable";
import type { CommentRow } from "@/components/admin/CommentsTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Accepts a raw post URL (e.g. https://…/posts/cm123) or a bare ID.
function parsePostRef(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/posts\/([^/?#\s]+)/);
  if (match) return match[1];
  return trimmed;
}

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; postId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const isPostMode = params.filter === "post" && !!params.postId;
  const resolvedPostId = isPostMode ? parsePostRef(params.postId ?? "") : "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = isPostMode && resolvedPostId ? { postId: resolvedPostId } : {};

  const [total, comments] = await Promise.all([
    db.comment.count({ where }),
    db.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

      <CommentsFilterRow
        mode={isPostMode ? "post" : "recent"}
        postId={resolvedPostId}
      />

      {rows.length === 0 ? (
        <p className="text-[16px] text-[var(--muted-foreground)] py-16 text-center">
          No comments found.
        </p>
      ) : (
        <CommentsTable rows={rows} />
      )}

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
