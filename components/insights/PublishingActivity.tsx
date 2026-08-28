import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus } from "@/app/generated/prisma/enums";
import { ActivityChart, type ChartPoint } from "@/components/admin/ActivityChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityName } from "@/components/ui/EntityName";
import { PageHeader } from "@/components/ui/PageHeader";
import { SpecStrip } from "@/components/ui/SpecStrip";
import { db } from "@/lib/db";
import { entityDisplayName } from "@/lib/org/display";
import { postScopeWhere, type ScopeFilter } from "@/lib/rbac/scope-filter";
import { isoWeekShortLabel, lastNIsoWeeks } from "@/lib/week";

/**
 * Shared by /insights (member analytics.view_entity) and /admin/activity
 * (platform credential) — each authorizes before calling in; this component
 * takes an already-resolved `scope` and does no auth of its own.
 */
export async function PublishingActivity({
  scope,
  breadcrumb,
  variant,
}: {
  scope: ScopeFilter;
  breadcrumb: Array<{ href?: string; label: string }>;
  /** `dense` = admin console's operational table (admin/activity only).
   *  `hairline` = member-facing (/insights) — same browsing-list treatment
   *  as /review; governance isn't administration. */
  variant: "dense" | "hairline";
}) {
  const scopeWhere: Prisma.PostWhereInput = postScopeWhere(scope);
  const weeks = lastNIsoWeeks(8);

  const [weekCounts, publishers, totals] = await Promise.all([
    db.post.groupBy({
      by: ["quotaPeriod"],
      where: {
        ...scopeWhere,
        quotaPeriod: { in: weeks },
        status: { in: [PostStatus.PUBLISHED, PostStatus.IN_REVIEW, PostStatus.SCHEDULED] },
      },
      _count: { _all: true },
    }),
    db.post.groupBy({
      by: ["authorId"],
      where: { ...scopeWhere, status: PostStatus.PUBLISHED },
      _count: { _all: true },
      orderBy: { _count: { authorId: "desc" } },
      take: 20,
    }),
    db.post.groupBy({
      by: ["status"],
      where: scopeWhere,
      _count: { _all: true },
    }),
  ]);

  const byWeek = new Map(weekCounts.map((r) => [r.quotaPeriod ?? "", r._count._all]));
  const chartData: ChartPoint[] = weeks.map((week) => ({
    week: isoWeekShortLabel(week),
    count: byWeek.get(week) ?? 0,
  }));

  const authors =
    publishers.length > 0
      ? await db.user.findMany({
          where: { id: { in: publishers.map((p) => p.authorId) } },
          select: {
            id: true,
            fullName: true,
            primaryEntity: { select: { name: true, kind: true } },
          },
        })
      : [];
  const authorById = new Map(authors.map((a) => [a.id, a]));

  const statusTotal = (status: PostStatus) =>
    totals.find((t) => t.status === status)?._count._all ?? 0;

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-8 sm:px-6">
      <PageHeader
        breadcrumb={breadcrumb}
        title="Publishing activity"
        standfirst={`${scope.kind === "all" ? "Across the whole network." : "Across your own entities."} Reach and read rate arrive once the read beacon is collecting.`}
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

      <div className="mt-10">
        <ActivityChart data={chartData} />
      </div>

      <section aria-labelledby="top-publishers" className="mt-10">
        <p id="top-publishers" className="pulse-label pulse-label-wide mb-5">
          Most active publishers
        </p>
        {publishers.length === 0 ? (
          <EmptyState
            eyebrow="No activity"
            heading="Nothing published yet."
            body="Publishing activity will appear here as soon as the first post goes out."
          />
        ) : variant === "dense" ? (
          <div className="aiesec-card overflow-x-auto p-0">
            <table className="w-full text-left">
              <caption className="sr-only">Publishers ordered by number of published posts</caption>
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th
                    scope="col"
                    className="px-4 py-3 text-[14px] font-medium text-[color:var(--muted-foreground)]"
                  >
                    Publisher
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-[14px] font-medium text-[color:var(--muted-foreground)]"
                  >
                    Entity
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-[14px] font-medium text-[color:var(--muted-foreground)]"
                  >
                    Published
                  </th>
                </tr>
              </thead>
              <tbody>
                {publishers.map((row) => {
                  const author = authorById.get(row.authorId);
                  const entity = entityDisplayName(
                    author?.primaryEntity?.name,
                    author?.primaryEntity?.kind
                  );
                  return (
                    <tr
                      key={row.authorId}
                      className="border-b border-[var(--border)] transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] last:border-0 hover:bg-[var(--muted)]"
                    >
                      <td className="px-4 py-3 text-[15px] text-[color:var(--foreground)]">
                        {author?.fullName ?? "Former member"}
                      </td>
                      <td className="px-4 py-3 text-[14px] text-[color:var(--muted-foreground)]">
                        {entity ? <EntityName name={entity} /> : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[15px] tabular-nums text-[color:var(--foreground)]">
                        {row._count._all}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col" role="list" aria-label="Publishers by post count">
            {publishers.map((row) => {
              const author = authorById.get(row.authorId);
              const entity = entityDisplayName(
                author?.primaryEntity?.name,
                author?.primaryEntity?.kind
              );
              return (
                <div
                  key={row.authorId}
                  role="listitem"
                  className="flex items-center justify-between gap-4 border-b border-[var(--hairline)] py-4 first:pt-0 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-[color:var(--foreground)]">
                      {author?.fullName ?? "Former member"}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-[color:var(--muted-foreground)]">
                      {entity ? <EntityName name={entity} /> : "—"}
                    </p>
                  </div>
                  <span className="pulse-serif pulse-serif-sm shrink-0 tabular-nums text-[color:var(--foreground)]">
                    {row._count._all}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
