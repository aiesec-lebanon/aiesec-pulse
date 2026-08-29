import type { Prisma } from "@/app/generated/prisma/client";
import { PageSizeSelect } from "@/components/admin/PageSizeSelect";
import { type CommentRow, CommentsTable } from "@/components/moderation/CommentsTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { TextTabs } from "@/components/ui/TextTabs";
import { db } from "@/lib/db";
import { entityDisplayName } from "@/lib/org/display";
import { requirePermission } from "@/lib/rbac/guards";
import { commentScopeWhere, resolveScopeFilter } from "@/lib/rbac/scope-filter";

export const dynamic = "force-dynamic";

export const metadata = { title: "Comments · AIESEC Pulse" };

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

export default async function ModerationCommentsPage({
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
        user: { select: { fullName: true, primaryEntity: { select: { name: true, kind: true } } } },
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
    authorEntity: entityDisplayName(c.user.primaryEntity?.name, c.user.primaryEntity?.kind),
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
    return `/moderation/comments?${next.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-8 sm:px-6">
      <PageHeader
        breadcrumb={[{ href: "/feed", label: "Feed" }, { label: "Comments" }]}
        title="Comments"
        standfirst="Hiding is reversible and always carries a reason the author can see."
        count={total}
        countLabel={total === 1 ? "comment" : "comments"}
        bordered={false}
      />

      <TextTabs
        ariaLabel="Filter comments"
        className="mt-8"
        items={VIEW_OPTIONS.map((option) => ({
          href: buildHref({ view: option.value, page: 1 }),
          label: option.label,
          isActive: view === option.value,
        }))}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="ml-auto">
          <PageSizeSelect current={limit} />
        </div>
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState heading="No comments match that filter." body="Try a different view above." />
        ) : (
          <CommentsTable rows={rows} />
        )}
      </div>

      <Pagination
        label="Comments pagination"
        page={page}
        hasNext={page < totalPages}
        previousHref={page > 1 ? buildHref({ page: page - 1 }) : null}
        nextHref={page < totalPages ? buildHref({ page: page + 1 }) : null}
      />
    </main>
  );
}
