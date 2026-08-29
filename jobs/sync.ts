import { recordAudit, systemActor } from "@/lib/audit";
import { syncIdentityFromGis } from "@/lib/auth/identity";
import { getUsableAccessToken } from "@/lib/auth/token-store";
import { cacheDelete, cacheKeys, invalidateUserAuthorisation } from "@/lib/cache";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { recomputeTree, rootEntity, upsertOffice } from "@/lib/org/entities";
import { currentTermLabel, termEndsAt } from "@/lib/term";
import { fetchCurrentPerson, fetchOfficePage, GisUnavailableError } from "@/server-utils/gis";

// Reconciliation is additive and expiring, never destructive.

export const JOB_KINDS = {
  syncEntities: "sync-entities",
  syncRoles: "sync-roles",
} as const;

type RunHandle = { id: string };

// A cron tick can fire while the previous one is still running (Vercel does
// not guarantee against overlap — see its cron-concurrency guidance). A
// SyncRun still RUNNING and started recently means one is genuinely in
// flight; older than this, it's a crashed run that never called finishRun,
// not a lock to respect.
const STALE_RUN_MINUTES = 30;

async function claimRun(kind: string): Promise<RunHandle | null> {
  const staleBefore = new Date(Date.now() - STALE_RUN_MINUTES * 60 * 1000);
  const active = await db.syncRun.findFirst({
    where: { kind, status: "RUNNING", startedAt: { gte: staleBefore } },
    select: { id: true },
  });
  if (active) return null;

  return db.syncRun.create({ data: { kind, status: "RUNNING" }, select: { id: true } });
}

async function startRun(kind: string): Promise<RunHandle> {
  return db.syncRun.create({ data: { kind, status: "RUNNING" }, select: { id: true } });
}

async function finishRun(
  run: RunHandle,
  status: "SUCCEEDED" | "FAILED" | "PARTIAL",
  counts: { processed: number; failed: number },
  error?: string
): Promise<void> {
  await db.syncRun.update({
    where: { id: run.id },
    data: { status, finishedAt: new Date(), ...counts, error: error?.slice(0, 1000) ?? null },
  });
}

// GIS has no service account; borrow a recent member's token, preferring
// global scope for the widest view of the tree.
async function borrowAccessToken(): Promise<string | null> {
  const candidates = await db.user.findMany({
    where: {
      status: "ACTIVE",
      oauthToken: { isNot: null },
      lastSeenAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: [{ lastSeenAt: "desc" }],
    take: 10,
    select: { id: true },
  });

  for (const candidate of candidates) {
    const token = await getUsableAccessToken(candidate.id);
    if (token) return token;
  }
  return null;
}

/**
 * Weekly GIS entity sync — triggered by Vercel Cron hitting
 * /api/cron/sync-entities. Recompute is required: a re-parented office's
 * descendants need new paths, or scope checks silently stop covering them.
 */
export async function runSyncEntities(): Promise<
  { status: "skipped" } | { processed: number; failed: number }
> {
  const run = await claimRun(JOB_KINDS.syncEntities);
  if (!run) {
    logger.warn("sync-entities skipped — a run is already in flight");
    return { status: "skipped" as const };
  }

  const token = await borrowAccessToken();
  if (!token) {
    await finishRun(
      run,
      "FAILED",
      { processed: 0, failed: 0 },
      "No usable GIS access token available"
    );
    logger.error("sync-entities could not obtain a GIS token", {
      consequence: "Entity tree is stale; login-time resolution still creates placeholders.",
    });
    return { status: "skipped" as const };
  }

  const result = await (async () => {
    const root = await rootEntity();
    let processed = 0;
    let failed = 0;
    let page = 1;
    let totalPages: number | null = null;

    while (page <= (totalPages ?? 50)) {
      try {
        const { offices, totalPages: reported } = await fetchOfficePage(token, page);
        totalPages = reported ?? totalPages;
        if (offices.length === 0) break;

        for (const office of offices) {
          try {
            // Parent first, so upsertOffice computes a path under the right node.
            const parent = office.parent?.id
              ? ((await db.entity.findUnique({ where: { gisOfficeId: office.parent.id } })) ?? root)
              : root;
            await upsertOffice(office, parent);
            processed++;
          } catch (error) {
            failed++;
            logger.warn("Failed to upsert an office", { gisOfficeId: office.id, error });
          }
        }
        page++;
      } catch (error) {
        if (error instanceof GisUnavailableError) {
          logger.warn("GIS office paging unavailable; stopping this run", { page, error });
          break;
        }
        throw error;
      }
    }
    return { processed, failed };
  })();

  const tree = await recomputeTree();
  await cacheDelete(cacheKeys.entityTree());
  await finishRun(run, result.failed > 0 ? "PARTIAL" : "SUCCEEDED", result);

  logger.info("sync-entities complete", { ...result, ...tree });
  return { ...result, ...tree };
}

/**
 * Daily role reconciliation — triggered by Vercel Cron hitting
 * /api/cron/sync-roles. Scoped to recent activity: login does a full
 * reconciliation anyway, so an inactive member's permissions can wait until
 * they next sign in.
 */
export async function runSyncRoles(
  activeSinceDays = 30
): Promise<{ status: "skipped" } | { processed: number; failed: number }> {
  const run = await claimRun(JOB_KINDS.syncRoles);
  if (!run) {
    logger.warn("sync-roles skipped — a run is already in flight");
    return { status: "skipped" as const };
  }

  const users = await db.user.findMany({
    where: {
      status: "ACTIVE",
      oauthToken: { isNot: null },
      lastSeenAt: { gte: new Date(Date.now() - activeSinceDays * 24 * 60 * 60 * 1000) },
    },
    orderBy: { lastSeenAt: "desc" },
    take: 2000,
    select: { id: true },
  });

  let processed = 0;
  let failed = 0;

  // Batched so one member's failure does not abandon the rest.
  const BATCH = 50;
  for (let i = 0; i < users.length; i += BATCH) {
    const batch = users.slice(i, i + BATCH);
    let ok = 0;
    let bad = 0;
    for (const user of batch) {
      try {
        const token = await getUsableAccessToken(user.id);
        if (!token) {
          bad++;
          continue;
        }
        const person = await fetchCurrentPerson(token);
        await syncIdentityFromGis(person);
        ok++;
      } catch (error) {
        bad++;
        logger.warn("Role reconciliation failed for a member", { userId: user.id, error });
      }
    }
    processed += ok;
    failed += bad;
  }

  await finishRun(run, failed > 0 ? "PARTIAL" : "SUCCEEDED", { processed, failed });

  logger.info("sync-roles complete", { processed, failed, activeSinceDays });
  return { processed, failed };
}

export type TermTransitionInput = { dryRun: boolean; termLabel?: string };
export type TermTransitionResult = {
  dryRun: boolean;
  termLabel: string;
  expiringCount: number;
  byRole: Record<string, number>;
  sample: Array<{ member: string; role: string; scope: string; fromTerm: string | null }>;
  applied?: number;
};

/**
 * Annual leadership handover — run by hand via `npm run job term-transition`
 * (scripts/run-job.ts), not on a schedule. Defaults to dry-run: a wrong run
 * at scale strips publishing rights from the network right when new
 * leadership needs them.
 */
export async function runTermTransition(input: TermTransitionInput): Promise<TermTransitionResult> {
  const dryRun = input.dryRun ?? true;
  const termLabel = input.termLabel ?? currentTermLabel();
  const run = await startRun(`term-transition:${dryRun ? "dry" : "apply"}`);

  const expiring = await db.roleGrant.findMany({
    where: {
      revokedAt: null,
      termLabel: { not: termLabel },
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      role: { key: { not: "member" } },
    },
    select: {
      id: true,
      termLabel: true,
      source: true,
      user: { select: { id: true, fullName: true } },
      role: { select: { key: true } },
      scope: { select: { name: true } },
    },
  });

  const diff: TermTransitionResult = {
    dryRun,
    termLabel,
    expiringCount: expiring.length,
    byRole: expiring.reduce<Record<string, number>>((acc, grant) => {
      acc[grant.role.key] = (acc[grant.role.key] ?? 0) + 1;
      return acc;
    }, {}),
    sample: expiring.slice(0, 25).map((g) => ({
      member: g.user.fullName,
      role: g.role.key,
      scope: g.scope?.name ?? "Global",
      fromTerm: g.termLabel,
    })),
  };

  if (dryRun) {
    await finishRun(
      run,
      "SUCCEEDED",
      { processed: 0, failed: 0 },
      JSON.stringify(diff).slice(0, 1000)
    );
    logger.info("term-transition dry run", diff);
    return diff;
  }

  const endsAt = termEndsAt(expiring[0]?.termLabel ?? termLabel) ?? new Date();
  const applied = await db.roleGrant.updateMany({
    where: { id: { in: expiring.map((g) => g.id) } },
    // `endsAt`, never DELETE, so historical attribution survives.
    data: { endsAt: endsAt > new Date() ? new Date() : endsAt },
  });
  for (const grant of expiring) await invalidateUserAuthorisation(grant.user.id);

  await recordAudit(
    systemActor("term-transition"),
    "term.transition_applied",
    { type: "term", id: termLabel },
    diff
  );

  await finishRun(run, "SUCCEEDED", { processed: applied.count, failed: 0 });

  // New-term grants arrive through sync-roles and login-time reconciliation
  // rather than being invented here — GIS is the authority.
  await runSyncRoles(90);

  logger.warn("term-transition applied", { ...diff, applied: applied.count });
  return { ...diff, applied: applied.count };
}
