import Link from "next/link";

import type { Prisma } from "@/app/generated/prisma/client";
import { type AuditRow, AuditTable } from "@/components/admin/AuditTable";
import { PageSizeSelect } from "@/components/admin/PageSizeSelect";
import { db } from "@/lib/db";
import { subtreeEntityIds } from "@/lib/org/entities";
import { requirePermission } from "@/lib/rbac/guards";
import { resolveScopeFilter } from "@/lib/rbac/scope-filter";

export const dynamic = "force-dynamic";

const ACTOR_OPTIONS = [
  { label: "All", value: "" },
  { label: "Members", value: "USER" },
  { label: "System", value: "SYSTEM" },
  { label: "Break-glass", value: "BREAK_GLASS" },
] as const;

function clampLimit(raw: string | undefined): number {
  const n = parseInt(raw ?? "50", 10);
  return [25, 50, 100].includes(n) ? n : 50;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; action?: string; page?: string; limit?: string }>;
}) {
  const user = await requirePermission("admin.audit_view");
  const scope = await resolveScopeFilter(user, "admin.audit_view");

  const params = await searchParams;
  const actor = ACTOR_OPTIONS.some((o) => o.value === params.actor) ? (params.actor ?? "") : "";
  const action = params.action?.trim() ?? "";
  const limit = clampLimit(params.limit);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  let entityScope: Prisma.AuditEventWhereInput = {};
  if (scope.kind === "none") {
    entityScope = { id: { in: [] } };
  } else if (scope.kind === "subtrees") {
    const entities = await db.entity.findMany({
      where: { OR: scope.paths.map((path) => ({ path })) },
      select: { id: true },
    });
    const ids = (await Promise.all(entities.map((e) => subtreeEntityIds(e.id)))).flat();
    entityScope = { entityId: { in: ids } };
  }

  const where: Prisma.AuditEventWhereInput = {
    ...entityScope,
    ...(actor ? { actorType: actor as "USER" | "SYSTEM" | "BREAK_GLASS" } : {}),
    ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
  };

  const [total, events] = await Promise.all([
    db.auditEvent.count({ where }),
    db.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const postIds = events.filter((e) => e.targetType === "post").map((e) => e.targetId);
  const entityIds = events.map((e) => e.entityId).filter((id): id is string => Boolean(id));

  const [posts, entities] = await Promise.all([
    postIds.length > 0
      ? db.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, slug: true, title: true },
        })
      : Promise.resolve([]),
    entityIds.length > 0
      ? db.entity.findMany({ where: { id: { in: entityIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const postById = new Map(posts.map((p) => [p.id, p]));
  const entityById = new Map(entities.map((e) => [e.id, e]));

  const rows: AuditRow[] = events.map((event) => {
    const post = event.targetType === "post" ? postById.get(event.targetId) : undefined;
    return {
      id: event.id,
      actorLabel: event.actorLabel ?? "Unknown actor",
      actorType: event.actorType,
      action: event.action,
      targetType: event.targetType,
      targetHref: post ? `/posts/${post.slug}` : null,
      targetLabel: post?.title ?? `${event.targetType} ${event.targetId.slice(-8)}`,
      entityName: event.entityId ? (entityById.get(event.entityId)?.name ?? null) : null,
      timestampAbs: event.createdAt.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestampIso: event.createdAt.toISOString(),
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const buildHref = (overrides: Record<string, string | number>) => {
    const next = new URLSearchParams();
    if (actor) next.set("actor", actor);
    if (action) next.set("action", action);
    next.set("limit", String(limit));
    next.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) next.set(k, String(v));
    return `/admin/audit?${next.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
      <h1 className="text-[24px] font-black text-[var(--foreground)]">Audit log</h1>
      <p className="mt-1 text-[15px] text-[var(--muted-foreground)]">
        Append-only. Entries are never edited or deleted — GDPR erasure removes the person, not the
        event.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <nav
          aria-label="Filter by actor"
          className="flex flex-wrap gap-1 rounded-[8px] bg-[var(--muted)] p-1"
        >
          {ACTOR_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildHref({ actor: option.value, page: 1 })}
              aria-current={actor === option.value ? "page" : undefined}
              className={[
                "min-h-[28px] rounded-[4px] px-3 py-1 text-[14px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
                actor === option.value
                  ? "bg-[var(--card)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <form method="get" action="/admin/audit" className="flex items-center gap-2">
          <label htmlFor="audit-action" className="sr-only">
            Filter by action
          </label>
          <input
            id="audit-action"
            name="action"
            type="search"
            defaultValue={action}
            placeholder="Action, e.g. post.hidden"
            className="min-h-[36px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[14px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
          />
          {actor && <input type="hidden" name="actor" value={actor} />}
          <input type="hidden" name="limit" value={limit} />
          <button type="submit" className="aiesec-btn-secondary min-h-[36px]">
            Filter
          </button>
        </form>

        <div className="ml-auto">
          <PageSizeSelect current={limit} />
        </div>
      </div>

      <p className="mt-4 text-[13px] text-[var(--muted-foreground)]" role="status">
        {total} {total === 1 ? "entry" : "entries"}
      </p>

      <div className="mt-3">
        {rows.length === 0 ? (
          <div className="aiesec-card px-8 py-12 text-center">
            <p className="text-[16px] text-[var(--muted-foreground)]">
              No entries match those filters.
            </p>
          </div>
        ) : (
          <AuditTable rows={rows} />
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
