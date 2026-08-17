import { inngest, JOB_IDS } from "@/jobs/client";
import { recordAudit, systemActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { buildExportBundle } from "@/lib/privacy/dsr";

// A schedule that exists only in a document is a policy, not a control.
// Published posts, comments and AuditEvent are never swept.

const DAY_MS = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY_MS);

export const retentionSweep = inngest.createFunction(
  { id: JOB_IDS.retentionSweep, retries: 2 },
  [{ cron: "30 3 * * *" }, { event: "privacy/retention.sweep.requested" }],
  async ({ event, step }) => {
    const dryRun =
      "dryRun" in (event.data ?? {}) ? Boolean((event.data as { dryRun?: boolean }).dryRun) : false;

    const run = await step.run("start", () =>
      db.syncRun.create({
        data: { kind: `retention-sweep:${dryRun ? "dry" : "apply"}`, status: "RUNNING" },
        select: { id: true },
      })
    );

    const counts = await step.run("sweep", async () => {
      const result: Record<string, number> = {};

      const drafts = { status: "DRAFT" as const, updatedAt: { lt: ago(365) } };
      result.drafts = dryRun
        ? await db.post.count({ where: drafts })
        : (await db.post.deleteMany({ where: drafts })).count;

      const notifications = { createdAt: { lt: ago(183) } };
      result.notifications = dryRun
        ? await db.notification.count({ where: notifications })
        : (await db.notification.deleteMany({ where: notifications })).count;

      const emails = { createdAt: { lt: ago(365) } };
      result.emailDeliveries = dryRun
        ? await db.emailDelivery.count({ where: emails })
        : (await db.emailDelivery.deleteMany({ where: emails })).count;

      const sessions = { expiresAt: { lt: ago(30) } };
      result.sessions = dryRun
        ? await db.session.count({ where: sessions })
        : (await db.session.deleteMany({ where: sessions })).count;

      const idleTokens = { user: { lastSeenAt: { lt: ago(90) } } };
      result.oauthTokens = dryRun
        ? await db.oauthToken.count({ where: idleTokens })
        : (await db.oauthToken.deleteMany({ where: idleTokens })).count;

      const syncRuns = { startedAt: { lt: ago(90) } };
      result.syncRuns = dryRun
        ? await db.syncRun.count({ where: syncRuns })
        : (await db.syncRun.deleteMany({ where: syncRuns })).count;

      const reports = { resolvedAt: { lt: ago(365 * 3) } };
      result.reports = dryRun
        ? await db.report.count({ where: reports })
        : (await db.report.deleteMany({ where: reports })).count;

      const appeals = { decidedAt: { lt: ago(365 * 3) } };
      result.appeals = dryRun
        ? await db.appeal.count({ where: appeals })
        : (await db.appeal.deleteMany({ where: appeals })).count;

      // Deleting raw reads before metrics-rollup exists would destroy
      // measurement that has not been rolled up, so this only reports.
      result.postReadsEligible = await db.postRead.count({
        where: { lastReadAt: { lt: ago(396) } },
      });

      return result;
    });

    // Per post because "latest N per group" has no single-statement Prisma form.
    const versionsPruned = await step.run("prune-versions", async () => {
      const noisy = await db.post.findMany({
        where: { versions: { some: {} } },
        select: { id: true, _count: { select: { versions: true } } },
        orderBy: { updatedAt: "desc" },
        take: 500,
      });

      let pruned = 0;
      for (const post of noisy.filter((p) => p._count.versions > 50)) {
        const keep = await db.postVersion.findMany({
          where: { postId: post.id },
          orderBy: { version: "desc" },
          take: 50,
          select: { id: true },
        });
        if (dryRun) {
          pruned += post._count.versions - keep.length;
          continue;
        }
        const removed = await db.postVersion.deleteMany({
          where: { postId: post.id, id: { notIn: keep.map((v) => v.id) } },
        });
        pruned += removed.count;
      }
      return pruned;
    });

    const summary = { ...counts, postVersions: versionsPruned, dryRun };

    await step.run("finish", async () => {
      await db.syncRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCEEDED",
          finishedAt: new Date(),
          processed: Object.values(counts).reduce((a, b) => a + b, 0) + versionsPruned,
          error: JSON.stringify(summary).slice(0, 1000),
        },
      });
      await recordAudit(
        systemActor("retention"),
        dryRun ? "retention.dry_run" : "retention.swept",
        { type: "system", id: "retention" },
        summary
      );
    });

    logger.info("retention-sweep complete", summary);
    return summary;
  }
);

// The operator-driven path: a request raised by email, or a subject whose
// account is suspended and who therefore cannot self-serve.
export const dsrExport = inngest.createFunction(
  { id: JOB_IDS.dsrExport, retries: 2 },
  [{ event: "privacy/dsr.export.requested" }],
  async ({ event, step }) => {
    const { requestId, userId } = event.data;

    const bundle = await step.run("build", () => buildExportBundle(userId));

    await step.run("record", async () => {
      await db.dataSubjectRequest.update({
        where: { id: requestId },
        data: { status: "IN_PROGRESS", notes: "Export bundle assembled and ready for delivery." },
      });
      await recordAudit(
        systemActor("privacy"),
        "dsr.export_assembled",
        { type: "data_subject_request", id: requestId },
        { userId, sizeBytes: JSON.stringify(bundle).length }
      );
    });

    return { requestId, ready: true };
  }
);
