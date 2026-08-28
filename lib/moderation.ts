import "server-only";

import { db } from "@/lib/db";
import type { ScopeFilter } from "@/lib/rbac/scope-filter";

async function scopeEntityIds(filter: ScopeFilter): Promise<string[] | null> {
  if (filter.kind === "all") return null;
  if (filter.kind === "none") return [];

  const rows = await db.entity.findMany({
    where: {
      OR: filter.paths.flatMap((path) => [{ path }, { path: { startsWith: `${path}/` } }]),
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export type QueueStats = {
  approvedToday: number;
  rejectedToday: number;
  /** null when nothing was reviewed today — there is no rate to average. */
  avgReviewMinutes: number | null;
};

// UI ref 8a's stat strip, scoped to what the approval flow actually audits
// (app/actions/posts.ts's `withAudit` calls) — not a "reason" taxonomy, since
// this workflow has no such field, so reason chips are deliberately absent.
export async function getQueueStats(scope: ScopeFilter): Promise<QueueStats> {
  const entityIds = await scopeEntityIds(scope);
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const events = await db.auditEvent.findMany({
    where: {
      action: { in: ["post.approved", "post.rejected"] },
      createdAt: { gte: startOfDay },
      ...(entityIds === null ? {} : { entityId: { in: entityIds } }),
    },
    select: { action: true, targetId: true, createdAt: true },
  });

  const approvedToday = events.filter((e) => e.action === "post.approved").length;
  const rejectedToday = events.filter((e) => e.action === "post.rejected").length;

  let avgReviewMinutes: number | null = null;
  if (events.length > 0) {
    const posts = await db.post.findMany({
      where: { id: { in: events.map((e) => e.targetId) } },
      select: { id: true, createdAt: true },
    });
    const submittedAt = new Map(posts.map((p) => [p.id, p.createdAt]));

    const diffsMs = events
      .map((e) => {
        const submitted = submittedAt.get(e.targetId);
        return submitted ? e.createdAt.getTime() - submitted.getTime() : null;
      })
      .filter((d): d is number => d !== null);

    if (diffsMs.length > 0) {
      avgReviewMinutes = Math.round(diffsMs.reduce((a, b) => a + b, 0) / diffsMs.length / 60000);
    }
  }

  return { approvedToday, rejectedToday, avgReviewMinutes };
}
