import Link from "next/link";
import { db } from "@/lib/db";
import { AuditTable, type AuditRow } from "@/components/admin/AuditTable";
import { AuditAdminSelect } from "@/components/admin/AuditAdminSelect";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type FilterKey = "approvals" | "rejections" | "deletions";

const ACTION_FILTER: Record<FilterKey, string[]> = {
  approvals: ["approve_post"],
  rejections: ["reject_post"],
  deletions: ["delete_post", "delete_comment"],
};

const ACTION_LABELS: Record<string, string> = {
  approve_post: "approved post",
  reject_post: "rejected post",
  delete_post: "deleted post",
  delete_comment: "deleted comment",
};

const ACTION_GROUP: Record<string, "approval" | "rejection" | "deletion"> = {
  approve_post: "approval",
  reject_post: "rejection",
  delete_post: "deletion",
  delete_comment: "deletion",
};

const FILTER_CHIPS = [
  { label: "All", key: "" },
  { label: "Approvals", key: "approvals" },
  { label: "Rejections", key: "rejections" },
  { label: "Deletions", key: "deletions" },
] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatAuditTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s} UTC`;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; adminId?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const filterKey = (params.filter ?? "") as FilterKey | "";
  const adminId = params.adminId ?? "";
  const cursor = params.cursor ?? "";

  const actionWhere =
    filterKey && ACTION_FILTER[filterKey]
      ? { action: { in: ACTION_FILTER[filterKey] } }
      : {};
  const adminWhere = adminId ? { adminId } : {};
  const where = { ...actionWhere, ...adminWhere };

  const [rawActions, allAdmins] = await Promise.all([
    db.adminAction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      include: { admin: { select: { email: true } } },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    db.admin.findMany({
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    }),
  ]);

  const hasNext = rawActions.length > PAGE_SIZE;
  const actions = hasNext ? rawActions.slice(0, PAGE_SIZE) : rawActions;

  // Batch target resolution — two queries, one per type
  const postIds = [
    ...new Set(
      actions.filter((a) => a.targetType === "post").map((a) => a.targetId),
    ),
  ];
  const commentIds = [
    ...new Set(
      actions.filter((a) => a.targetType === "comment").map((a) => a.targetId),
    ),
  ];

  const [posts, comments] = await Promise.all([
    postIds.length > 0
      ? db.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, title: true },
        })
      : [],
    commentIds.length > 0
      ? db.comment.findMany({
          where: { id: { in: commentIds } },
          select: { id: true, postId: true },
        })
      : [],
  ]);

  const postMap = new Map(posts.map((p) => [p.id, p]));
  const commentMap = new Map(comments.map((c) => [c.id, c]));

  const rows: AuditRow[] = actions.map((a) => {
    let targetHref: string | null = null;
    let targetLabel: string | null = null;

    if (a.targetType === "post") {
      const post = postMap.get(a.targetId);
      if (post) {
        targetHref = `/posts/${post.id}`;
        targetLabel = post.title;
      }
    } else {
      const comment = commentMap.get(a.targetId);
      if (comment) {
        targetHref = `/posts/${comment.postId}`;
        targetLabel = "comment";
      }
    }

    return {
      id: a.id,
      adminEmail: a.admin.email,
      actionLabel: ACTION_LABELS[a.action] ?? a.action,
      actionGroup: ACTION_GROUP[a.action] ?? "deletion",
      targetType: a.targetType as "post" | "comment",
      targetHref,
      targetLabel,
      timestampAbs: formatAuditTimestamp(a.createdAt),
      timestampIso: a.createdAt.toISOString(),
    };
  });

  const nextCursor = hasNext ? actions[actions.length - 1].id : null;
  const isFirstPage = !cursor;

  function buildHref(overrides: Record<string, string | undefined>): string {
    const merged: Record<string, string | undefined> = {
      filter: filterKey || undefined,
      adminId: adminId || undefined,
      cursor: cursor || undefined,
      ...overrides,
    };
    const q = new URLSearchParams();
    if (merged.filter) q.set("filter", merged.filter);
    if (merged.adminId) q.set("adminId", merged.adminId);
    if (merged.cursor) q.set("cursor", merged.cursor);
    const qs = q.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
      <h1 className="text-[20px] font-bold text-[var(--foreground)] mb-6">
        Audit Log
      </h1>

      {/* Filters row */}
      <div
        className="flex flex-wrap items-center gap-3 mb-6"
        role="group"
        aria-label="Filter audit entries"
      >
        {/* Action-type chips */}
        {FILTER_CHIPS.map(({ label, key }) => {
          const isActive = filterKey === key;
          return (
            <Link
              key={key}
              href={buildHref({ filter: key || undefined, cursor: undefined })}
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

        {/* Admin dropdown — shown only when there are multiple admins */}
        {allAdmins.length > 1 && (
          <AuditAdminSelect
            admins={allAdmins}
            currentAdminId={adminId}
            currentFilter={filterKey}
          />
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-[16px] text-[var(--muted-foreground)] py-16 text-center">
          No audit entries found.
        </p>
      ) : (
        <AuditTable rows={rows} />
      )}

      {/* Pagination — "Latest" back-link + "Older" forward cursor */}
      {(nextCursor !== null || !isFirstPage) && (
        <nav
          className="flex items-center justify-between mt-8"
          aria-label="Pagination"
        >
          {!isFirstPage ? (
            <Link
              href={buildHref({ cursor: undefined })}
              className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[14px] font-medium text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              ← Latest
            </Link>
          ) : (
            <span />
          )}

          {nextCursor !== null && (
            <Link
              href={buildHref({ cursor: nextCursor })}
              className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[14px] font-medium text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              Older →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
