import { inngest, JOB_IDS } from "@/jobs/client";
import { recordAudit, systemActor } from "@/lib/audit";
import { syncIdentityFromGis } from "@/lib/auth/identity";
import { getUsableAccessToken } from "@/lib/auth/token-store";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { recomputeTree, rootEntity, upsertOffice } from "@/lib/org/entities";
import { cacheDelete, cacheKeys, invalidateUserAuthorisation } from "@/lib/redis";
import { currentTermLabel, termEndsAt } from "@/lib/term";
import { fetchCurrentPerson, fetchOfficePage, GisUnavailableError } from "@/server-utils/gis";

// Reconciliation is additive and expiring, never destructive.

type RunHandle = { id: string };

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

// Recompute is required: a re-parented office's descendants need new
// paths, or scope checks silently stop covering them.
export const syncEntities = inngest.createFunction(
  { id: JOB_IDS.syncEntities, retries: 2 },
  [{ cron: "0 3 * * 1" }, { event: "org/entities.sync.requested" }],
  async ({ step }) => {
    const run = await step.run("start", () => startRun("sync-entities"));

    const token = await step.run("borrow-token", borrowAccessToken);
    if (!token) {
      await step.run("no-token", () =>
        finishRun(
          run,
          "FAILED",
          { processed: 0, failed: 0 },
          "No usable GIS access token available"
        )
      );
      logger.error("sync-entities could not obtain a GIS token", {
        consequence: "Entity tree is stale; login-time resolution still creates placeholders.",
      });
      return { status: "skipped" as const };
    }

    const result = await step.run("ingest-offices", async () => {
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
                ? ((await db.entity.findUnique({ where: { gisOfficeId: office.parent.id } })) ??
                  root)
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
    });

    const tree = await step.run("recompute-tree", recomputeTree);
    await step.run("bust-cache", () => cacheDelete(cacheKeys.entityTree()));
    await step.run("finish", () =>
      finishRun(run, result.failed > 0 ? "PARTIAL" : "SUCCEEDED", result)
    );

    logger.info("sync-entities complete", { ...result, ...tree });
    return { ...result, ...tree };
  }
);

// Scoped to recent activity: login does a full reconciliation anyway, so an
// inactive member's permissions can wait until they next sign in.
export const syncRoles = inngest.createFunction(
  { id: JOB_IDS.syncRoles, retries: 2 },
  [{ cron: "0 2 * * *" }, { event: "org/roles.sync.requested" }],
  async ({ event, step }) => {
    const activeSinceDays =
      (event.data as { activeSinceDays?: number } | undefined)?.activeSinceDays ?? 30;
    const run = await step.run("start", () => startRun("sync-roles"));

    const users = await step.run("select-users", () =>
      db.user.findMany({
        where: {
          status: "ACTIVE",
          oauthToken: { isNot: null },
          lastSeenAt: { gte: new Date(Date.now() - activeSinceDays * 24 * 60 * 60 * 1000) },
        },
        orderBy: { lastSeenAt: "desc" },
        take: 2000,
        select: { id: true },
      })
    );

    let processed = 0;
    let failed = 0;

    // Batched so one member's failure does not abandon the rest.
    const BATCH = 50;
    for (let i = 0; i < users.length; i += BATCH) {
      const batch = users.slice(i, i + BATCH);
      const counts = await step.run(`reconcile-${i / BATCH}`, async () => {
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
        return { ok, bad };
      });
      processed += counts.ok;
      failed += counts.bad;
    }

    await step.run("finish", () =>
      finishRun(run, failed > 0 ? "PARTIAL" : "SUCCEEDED", { processed, failed })
    );

    logger.info("sync-roles complete", { processed, failed, activeSinceDays });
    return { processed, failed };
  }
);

// Defaults to dry-run: a wrong run at scale strips publishing rights from
// the network right when new leadership needs them.
export const termTransition = inngest.createFunction(
  { id: JOB_IDS.termTransition, retries: 1 },
  [{ event: "org/term.transition.requested" }],
  async ({ event, step }) => {
    const payload = event.data as { dryRun?: boolean; termLabel?: string } | undefined;
    const dryRun = payload?.dryRun ?? true;
    const termLabel = payload?.termLabel ?? currentTermLabel();
    const run = await step.run("start", () =>
      startRun(`term-transition:${dryRun ? "dry" : "apply"}`)
    );

    const expiring = await step.run("find-expiring", () =>
      db.roleGrant.findMany({
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
      })
    );

    const diff = {
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
      await step.run("finish-dry", () =>
        finishRun(
          run,
          "SUCCEEDED",
          { processed: 0, failed: 0 },
          JSON.stringify(diff).slice(0, 1000)
        )
      );
      logger.info("term-transition dry run", diff);
      return { dryRun: true, ...diff };
    }

    const applied = await step.run("expire-grants", async () => {
      const endsAt = termEndsAt(expiring[0]?.termLabel ?? termLabel) ?? new Date();
      const result = await db.roleGrant.updateMany({
        where: { id: { in: expiring.map((g) => g.id) } },
        // `endsAt`, never DELETE, so historical attribution survives.
        data: { endsAt: endsAt > new Date() ? new Date() : endsAt },
      });
      for (const grant of expiring) await invalidateUserAuthorisation(grant.user.id);
      return result.count;
    });

    await step.run("audit", () =>
      recordAudit(
        systemActor("term-transition"),
        "term.transition_applied",
        { type: "term", id: termLabel },
        diff
      )
    );

    await step.run("finish", () => finishRun(run, "SUCCEEDED", { processed: applied, failed: 0 }));

    // New-term grants arrive through sync-roles and login-time reconciliation
    // rather than being invented here — GIS is the authority.
    await step.sendEvent("trigger-role-sync", {
      name: "org/roles.sync.requested",
      data: { trigger: "manual", activeSinceDays: 90 },
    });

    logger.warn("term-transition applied", { ...diff, applied });
    return { dryRun: false, ...diff, applied };
  }
);
