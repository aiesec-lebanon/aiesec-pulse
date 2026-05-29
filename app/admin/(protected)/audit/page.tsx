import Link from "next/link";
import { db } from "@/lib/db";
import { UserRole } from "@/app/generated/prisma/enums";
import { AuditTable, type AuditRow } from "@/components/admin/AuditTable";
import { AuditFilters } from "@/components/admin/AuditFilters";
import { PageSizeSelect } from "@/components/admin/PageSizeSelect";

export const dynamic = "force-dynamic";

// ---------- constants -------------------------------------------------------

const ADMIN_ACTIONS: Record<string, string[]> = {
  approvals: ["approve_post"],
  rejections: ["reject_post"],
  deletions: ["delete_post", "delete_comment"],
};

const USER_ACTIONS: Record<string, string[]> = {
  creations: ["create_post", "add_comment"],
};

const ACTION_LABEL: Record<string, string> = {
  approve_post: "approved post",
  reject_post: "rejected post",
  delete_post: "deleted post",
  delete_comment: "deleted comment",
  create_post: "created post",
  add_comment: "added comment",
};

const ACTION_GROUP: Record<string, AuditRow["actionGroup"]> = {
  approve_post: "approval",
  reject_post: "rejection",
  delete_post: "deletion",
  delete_comment: "deletion",
  create_post: "creation",
  add_comment: "creation",
};

// ---------- helpers ---------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtTimestamp(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

function clampLimit(raw: string | undefined): number {
  const n = parseInt(raw ?? "25", 10);
  return [10, 25, 50, 100].includes(n) ? n : 25;
}

function clampPage(raw: string | undefined): number {
  return Math.max(1, parseInt(raw ?? "1", 10) || 1);
}

// ---------- page ------------------------------------------------------------

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    role?: string;
    q?: string;
    from?: string;
    to?: string;
    limit?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const filter = params.filter ?? "";
  const role = params.role ?? "";
  const q = params.q?.trim() ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const limit = clampLimit(params.limit);
  const page = clampPage(params.page);
  const skip = (page - 1) * limit;

  // Decide which tables to query
  const queryAdmin =
    filter !== "creations" && role !== "mcp" && role !== "member";
  const queryUser =
    filter !== "approvals" &&
    filter !== "rejections" &&
    filter !== "deletions" &&
    role !== "admin";

  // Date range
  const fromDate = from ? new Date(from + "T00:00:00.000Z") : undefined;
  const toDate = to ? new Date(to + "T23:59:59.999Z") : undefined;
  const dateWhere =
    fromDate || toDate
      ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {};

  // Admin action where
  const adminActionWhere = {
    ...(filter && ADMIN_ACTIONS[filter] ? { action: { in: ADMIN_ACTIONS[filter] } } : {}),
    ...(q ? { admin: { email: { contains: q, mode: "insensitive" as const } } } : {}),
    ...dateWhere,
  };

  // User action where
  const userRoleFilter =
    role === "mcp" ? { role: UserRole.MCP } : role === "member" ? { role: UserRole.MEMBER } : {};
  const userRelFilter = {
    ...userRoleFilter,
    ...(q ? { fullName: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const userActionWhere = {
    ...(filter && USER_ACTIONS[filter] ? { action: { in: USER_ACTIONS[filter] } } : {}),
    ...(Object.keys(userRelFilter).length ? { user: userRelFilter } : {}),
    ...dateWhere,
  };

  // When merging two tables we fetch page*limit rows from each so the sort
  // order across the merged list is preserved for the requested page.
  const fetchN = page * limit;

  const [adminRaw, userRaw, adminTotal, userTotal] = await Promise.all([
    queryAdmin
      ? db.adminAction.findMany({
          where: adminActionWhere,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: queryUser ? fetchN : limit,
          skip: queryUser ? 0 : skip,
          include: { admin: { select: { email: true } } },
        })
      : Promise.resolve([]),
    queryUser
      ? db.userAction.findMany({
          where: userActionWhere,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: queryAdmin ? fetchN : limit,
          skip: queryAdmin ? 0 : skip,
          include: { user: { select: { fullName: true, role: true } } },
        })
      : Promise.resolve([]),
    queryAdmin ? db.adminAction.count({ where: adminActionWhere }) : Promise.resolve(0),
    queryUser ? db.userAction.count({ where: userActionWhere }) : Promise.resolve(0),
  ]);

  const total = adminTotal + userTotal;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Batch target resolution
  const allPostIds = [
    ...new Set([
      ...adminRaw.filter((a) => a.targetType === "post").map((a) => a.targetId),
      ...userRaw.filter((a) => a.targetType === "post").map((a) => a.targetId),
    ]),
  ];
  const allCommentIds = [
    ...new Set([
      ...adminRaw.filter((a) => a.targetType === "comment").map((a) => a.targetId),
      ...userRaw.filter((a) => a.targetType === "comment").map((a) => a.targetId),
    ]),
  ];

  const [postRows, commentRows] = await Promise.all([
    allPostIds.length
      ? db.post.findMany({ where: { id: { in: allPostIds } }, select: { id: true, title: true } })
      : [],
    allCommentIds.length
      ? db.comment.findMany({ where: { id: { in: allCommentIds } }, select: { id: true, postId: true } })
      : [],
  ]);

  const postMap = new Map(postRows.map((p) => [p.id, p]));
  const commentMap = new Map(commentRows.map((c) => [c.id, c]));

  function resolveTarget(
    targetType: string,
    targetId: string,
  ): { href: string | null; label: string | null } {
    if (targetType === "post") {
      const p = postMap.get(targetId);
      return p ? { href: `/admin/posts/${p.id}`, label: p.title } : { href: null, label: null };
    }
    const c = commentMap.get(targetId);
    return c
      ? { href: `/admin/posts/${c.postId}`, label: "comment" }
      : { href: null, label: null };
  }

  // Map to unified AuditRow
  const adminRows: (AuditRow & { _ts: string })[] = adminRaw.map((a) => {
    const { href, label } = resolveTarget(a.targetType, a.targetId);
    return {
      id: `admin-${a.id}`,
      actorLabel: a.admin.email,
      actorType: "admin",
      actionLabel: ACTION_LABEL[a.action] ?? a.action,
      actionGroup: ACTION_GROUP[a.action] ?? "deletion",
      targetType: a.targetType as "post" | "comment",
      targetHref: href,
      targetLabel: label,
      timestampAbs: fmtTimestamp(a.createdAt),
      timestampIso: a.createdAt.toISOString(),
      _ts: a.createdAt.toISOString(),
    };
  });

  const userRows: (AuditRow & { _ts: string })[] = userRaw.map((a) => {
    const { href, label } = resolveTarget(a.targetType, a.targetId);
    const actorType: AuditRow["actorType"] =
      a.user.role === UserRole.MCP ? "mcp" : "member";
    return {
      id: `user-${a.id}`,
      actorLabel: a.user.fullName,
      actorType,
      actionLabel: ACTION_LABEL[a.action] ?? a.action,
      actionGroup: ACTION_GROUP[a.action] ?? "creation",
      targetType: a.targetType as "post" | "comment",
      targetHref: href,
      targetLabel: label,
      timestampAbs: fmtTimestamp(a.createdAt),
      timestampIso: a.createdAt.toISOString(),
      _ts: a.createdAt.toISOString(),
    };
  });

  // Merge, sort desc, then slice to the current page window
  const merged = [...adminRows, ...userRows]
    .sort((a, b) => b._ts.localeCompare(a._ts));

  const rows: AuditRow[] = (
    queryAdmin && queryUser ? merged.slice(skip, skip + limit) : merged
  ).map(({ _ts: _unused, ...row }) => row);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    if (role) params.set("role", role);
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (limit !== 25) params.set("limit", String(limit));
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
      <h1 className="text-[20px] font-bold text-[var(--foreground)] mb-6">
        Audit Log
        <span className="ml-3 text-[16px] font-normal text-[var(--muted-foreground)] tabular-nums">
          {total}
        </span>
      </h1>

      <AuditFilters
        filter={filter}
        role={role}
        q={q}
        from={from}
        to={to}
        limit={limit}
      />

      {rows.length === 0 ? (
        <p className="text-[16px] text-[var(--muted-foreground)] py-16 text-center">
          No audit entries found.
        </p>
      ) : (
        <AuditTable rows={rows} />
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
