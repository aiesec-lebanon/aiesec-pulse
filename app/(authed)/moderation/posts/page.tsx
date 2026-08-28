import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus } from "@/app/generated/prisma/enums";
import { PageSizeSelect } from "@/components/admin/PageSizeSelect";
import { PostsSearch } from "@/components/moderation/PostsSearch";
import { type PostRow, PostsTable } from "@/components/moderation/PostsTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SpecStrip } from "@/components/ui/SpecStrip";
import { TextTabs } from "@/components/ui/TextTabs";
import { db } from "@/lib/db";
import { entityDisplayName } from "@/lib/org/display";
import { requirePermission } from "@/lib/rbac/guards";
import { postScopeWhere, resolveScopeFilter } from "@/lib/rbac/scope-filter";

// Without postScopeWhere this is a cross-entity read of unpublished content.
export const dynamic = "force-dynamic";

export const metadata = { title: "All posts · AIESEC Pulse" };

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

export default async function ModerationPostsPage({
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

  const [total, posts, statusTotals] = await Promise.all([
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
        publisher: { select: { name: true, kind: true } },
      },
    }),
    db.post.groupBy({
      by: ["status"],
      where: postScopeWhere(scope),
      _count: { _all: true },
    }),
  ]);

  const statusTotal = (s: PostStatus) => statusTotals.find((t) => t.status === s)?._count._all ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const rows: PostRow[] = posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    status: p.status,
    authorName: p.author.fullName,
    authorEntity: entityDisplayName(p.publisher.name, p.publisher.kind) ?? p.publisher.name,
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
    return `/moderation/posts?${next.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-8 sm:px-6">
      <PageHeader
        breadcrumb={[{ href: "/feed", label: "Feed" }, { label: "All posts" }]}
        title="All posts"
        standfirst={
          scope.kind === "all"
            ? "Every post across the network."
            : "Posts published by entities in your moderation scope."
        }
        count={total}
        countLabel={total === 1 ? "post" : "posts"}
        bordered={false}
      />

      <SpecStrip
        ariaLabel="Post status totals"
        className="mt-8"
        cells={[
          {
            label: "Published",
            value: <span className="tabular">{statusTotal(PostStatus.PUBLISHED)}</span>,
          },
          {
            label: "In review",
            value: <span className="tabular">{statusTotal(PostStatus.IN_REVIEW)}</span>,
          },
          {
            label: "Rejected",
            value: <span className="tabular">{statusTotal(PostStatus.REJECTED)}</span>,
          },
          {
            label: "Hidden",
            value: <span className="tabular">{statusTotal(PostStatus.HIDDEN)}</span>,
          },
        ]}
      />

      <TextTabs
        ariaLabel="Filter by status"
        className="mt-8"
        items={STATUS_OPTIONS.map((option) => ({
          href: buildHref({ status: option.value, page: 1 }),
          label: option.label,
          isActive: statusParam === option.value,
        }))}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PostsSearch q={q} status={statusParam} limit={limit} />
        <div className="ml-auto">
          <PageSizeSelect current={limit} />
        </div>
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            heading="No posts match those filters."
            body="Try widening the status filter or clearing the search above."
          />
        ) : (
          <PostsTable rows={rows} />
        )}
      </div>

      <Pagination
        label="Posts pagination"
        page={page}
        hasNext={page < totalPages}
        previousHref={page > 1 ? buildHref({ page: page - 1 }) : null}
        nextHref={page < totalPages ? buildHref({ page: page + 1 }) : null}
      />
    </main>
  );
}
