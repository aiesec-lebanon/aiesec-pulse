import { redirect } from "next/navigation";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus } from "@/app/generated/prisma/enums";
import { ActivityChart, type ChartPoint } from "@/components/admin/ActivityChart";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { requireSession } from "@/lib/rbac/guards";
import { postScopeWhere, resolveScopeFilter } from "@/lib/rbac/scope-filter";
import { isoWeekShortLabel, lastNIsoWeeks } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const user = await requireSession();

  const network = await can(user, "analytics.view_network");
  const entity = await can(user, "analytics.view_entity");
  if (!network && !entity) redirect("/unauthorized");

  const scope = network
    ? { kind: "all" as const }
    : await resolveScopeFilter(user, "analytics.view_entity");

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
          select: { id: true, fullName: true, primaryEntity: { select: { name: true } } },
        })
      : [];
  const authorById = new Map(authors.map((a) => [a.id, a]));

  const statusTotal = (status: PostStatus) =>
    totals.find((t) => t.status === status)?._count._all ?? 0;

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
      <h1 className="text-[24px] font-black text-[color:var(--foreground)]">Publishing activity</h1>
      <p className="mt-1 text-[15px] text-[color:var(--muted-foreground)]">
        {network ? "Across the whole network." : "Across the entities you administer."} Reach and
        read rate arrive once the read beacon is collecting.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Published" value={statusTotal(PostStatus.PUBLISHED)} />
        <Stat label="In review" value={statusTotal(PostStatus.IN_REVIEW)} />
        <Stat label="Rejected" value={statusTotal(PostStatus.REJECTED)} />
        <Stat label="Hidden" value={statusTotal(PostStatus.HIDDEN)} />
      </div>

      <div className="mt-6">
        <ActivityChart data={chartData} />
      </div>

      <section aria-labelledby="top-publishers">
        <h2
          id="top-publishers"
          className="mb-3 text-[16px] font-bold text-[color:var(--foreground)]"
        >
          Most active publishers
        </h2>
        {publishers.length === 0 ? (
          <div className="aiesec-card px-8 py-12 text-center">
            <p className="text-[16px] text-[color:var(--muted-foreground)]">
              Nothing published yet.
            </p>
          </div>
        ) : (
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
                  return (
                    <tr
                      key={row.authorId}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-4 py-3 text-[15px] text-[color:var(--foreground)]">
                        {author?.fullName ?? "Former member"}
                      </td>
                      <td className="px-4 py-3 text-[14px] text-[color:var(--muted-foreground)]">
                        {author?.primaryEntity?.name ?? "—"}
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
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="aiesec-card px-5 py-4">
      <p className="text-[28px] font-bold text-[color:var(--foreground)]">{value}</p>
      <p className="mt-0.5 text-[13px] text-[color:var(--muted-foreground)]">{label}</p>
    </div>
  );
}
