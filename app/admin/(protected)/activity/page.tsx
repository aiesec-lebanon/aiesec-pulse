import Link from "next/link";
import { db } from "@/lib/db";
import { PostStatus, UserRole } from "@/app/generated/prisma/enums";
import { currentIsoWeek, lastNIsoWeeks, isoWeekShortLabel } from "@/lib/week";
import { ActivityChart, type ChartPoint } from "@/components/admin/ActivityChart";
import { ActivityTable, type ActivityRow, type SortKey, type SortDir } from "@/components/admin/ActivityTable";
import { ActivitySearch } from "@/components/admin/ActivitySearch";
import { PageSizeSelect } from "@/components/admin/PageSizeSelect";

export const dynamic = "force-dynamic";

const VALID_SORT_KEYS: SortKey[] = [
  "name",
  "entity",
  "totalPosts",
  "postsThisWeek",
  "postsThisMonth",
  "pending",
  "lastPost",
];

function parseSortKey(raw: string | undefined): SortKey {
  if (raw && (VALID_SORT_KEYS as string[]).includes(raw)) return raw as SortKey;
  return "postsThisWeek";
}

function parseSortDir(raw: string | undefined): SortDir {
  return raw === "asc" ? "asc" : "desc";
}

function clampLimit(raw: string | undefined): number {
  const n = parseInt(raw ?? "25", 10);
  return [10, 25, 50, 100].includes(n) ? n : 25;
}

function sortRows(rows: ActivityRow[], sort: SortKey, dir: SortDir): ActivityRow[] {
  return [...rows].sort((a, b) => {
    let diff: number;
    switch (sort) {
      case "name":
        diff = a.name.localeCompare(b.name);
        break;
      case "entity":
        diff = (a.entity || "").localeCompare(b.entity || "");
        break;
      case "totalPosts":
        diff = a.totalPosts - b.totalPosts;
        break;
      case "postsThisWeek":
        diff = a.postsThisWeek - b.postsThisWeek;
        break;
      case "postsThisMonth":
        diff = a.postsThisMonth - b.postsThisMonth;
        break;
      case "pending":
        diff = a.pending - b.pending;
        break;
      case "lastPost":
        diff = (a.lastPost?.getTime() ?? 0) - (b.lastPost?.getTime() ?? 0);
        break;
      default:
        diff = 0;
    }
    return dir === "desc" ? -diff : diff;
  });
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; q?: string; limit?: string; page?: string }>;
}) {
  const params = await searchParams;
  const sort = parseSortKey(params.sort);
  const dir = parseSortDir(params.dir);
  const q = params.q?.trim() ?? "";
  const limit = clampLimit(params.limit);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const skip = (page - 1) * limit;

  const now = new Date();
  const currentWeek = currentIsoWeek(now);
  const last8Weeks = lastNIsoWeeks(8, now);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const userWhere = {
    role: UserRole.MCP,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { committeeName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [
    chartRaw,
    totalMcps,
    totalRaw,
    weekRaw,
    monthRaw,
    pendingRaw,
    lastPostRaw,
    mcpUsers,
  ] = await Promise.all([
    db.post.groupBy({
      by: ["weekIso"],
      where: { weekIso: { in: last8Weeks } },
      _count: { id: true },
      orderBy: { weekIso: "asc" },
    }),
    db.user.count({ where: userWhere }),
    db.post.groupBy({
      by: ["authorId"],
      _count: { id: true },
    }),
    db.post.groupBy({
      by: ["authorId"],
      where: { weekIso: currentWeek },
      _count: { id: true },
    }),
    db.post.groupBy({
      by: ["authorId"],
      where: { createdAt: { gte: startOfMonth } },
      _count: { id: true },
    }),
    db.post.groupBy({
      by: ["authorId"],
      where: { status: PostStatus.PENDING },
      _count: { id: true },
    }),
    db.post.groupBy({
      by: ["authorId"],
      _max: { createdAt: true },
    }),
    db.user.findMany({
      where: userWhere,
      select: { id: true, fullName: true, committeeName: true },
    }),
  ]);

  // Build lookup maps
  const totalMap = new Map(totalRaw.map((r) => [r.authorId, r._count.id]));
  const weekMap = new Map(weekRaw.map((r) => [r.authorId, r._count.id]));
  const monthMap = new Map(monthRaw.map((r) => [r.authorId, r._count.id]));
  const pendingMap = new Map(pendingRaw.map((r) => [r.authorId, r._count.id]));
  const lastPostMap = new Map(
    lastPostRaw.map((r) => [r.authorId, r._max.createdAt as Date | null])
  );

  // Chart data — global across all MCPs regardless of search
  const weekCountMap = new Map(chartRaw.map((r) => [r.weekIso, r._count.id]));
  const chartData: ChartPoint[] = last8Weeks.map((w) => ({
    week: isoWeekShortLabel(w),
    count: weekCountMap.get(w) ?? 0,
  }));

  // Build per-MCP rows for all filtered users
  const allRows: ActivityRow[] = mcpUsers.map((u) => ({
    userId: u.id,
    name: u.fullName,
    entity: u.committeeName ?? "",
    totalPosts: totalMap.get(u.id) ?? 0,
    postsThisWeek: weekMap.get(u.id) ?? 0,
    postsThisMonth: monthMap.get(u.id) ?? 0,
    pending: pendingMap.get(u.id) ?? 0,
    lastPost: lastPostMap.get(u.id) ?? null,
  }));

  const sorted = sortRows(allRows, sort, dir);
  const totalPages = Math.max(1, Math.ceil(totalMcps / limit));
  const pageRows = sorted.slice(skip, skip + limit);

  function pageHref(p: number) {
    const qp = new URLSearchParams();
    if (sort !== "postsThisWeek") qp.set("sort", sort);
    if (dir !== "desc") qp.set("dir", dir);
    if (q) qp.set("q", q);
    if (limit !== 25) qp.set("limit", String(limit));
    if (p > 1) qp.set("page", String(p));
    const qs = qp.toString();
    return `/admin/activity${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
      <h1 className="text-[20px] font-bold text-[var(--foreground)] mb-6">
        MCP Activity
        <span className="ml-3 text-[16px] font-normal text-[var(--muted-foreground)] tabular-nums">
          {totalMcps}
        </span>
      </h1>

      <ActivityChart data={chartData} />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <ActivitySearch q={q} sort={sort} dir={dir} limit={limit} />
      </div>

      {pageRows.length === 0 ? (
        <div className="flex flex-col items-center py-24 gap-4 text-center">
          <svg
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-16 h-16 text-[var(--muted-foreground)] opacity-40"
            aria-hidden="true"
          >
            <rect x="8" y="36" width="12" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
            <rect x="26" y="24" width="12" height="32" rx="2" stroke="currentColor" strokeWidth="2" />
            <rect x="44" y="12" width="12" height="44" rx="2" stroke="currentColor" strokeWidth="2" />
          </svg>
          <p className="text-[16px] font-bold text-[var(--foreground)]">
            {q ? "No MCPs found." : "No MCP activity yet"}
          </p>
          <p className="text-[14px] text-[var(--muted-foreground)]">
            {q
              ? "Try a different search term."
              : "Posts will appear here once MCPs start publishing."}
          </p>
        </div>
      ) : (
        <ActivityTable rows={pageRows} sort={sort} dir={dir} q={q} limit={limit} />
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
