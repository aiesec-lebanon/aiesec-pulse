import { sweepMedia } from "@/jobs/media";
import {
  LEGACY_REFUSED_SIGN_IN_TARGET,
  recordAudit,
  REFUSED_SIGN_IN_TARGET,
  systemActor,
} from "@/lib/audit";
import { SESSION_IDLE_DAYS } from "@/lib/auth/session";
import { pseudonymousRef } from "@/lib/crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { buildExportBundle, executeErasure } from "@/lib/privacy/dsr";

// Published posts and visible comments stay as the organisational record. The
// periods below are the ones the privacy notice (Annex C of the M2 policy) states.
const AUDIT_RETENTION_DAYS = 730;
const AUDIT_CONTEXT_DAYS = 90;
const REFUSED_SIGN_IN_DAYS = 90;
const DELETED_COMMENT_DAYS = 30;
const PRIVACY_REQUEST_DAYS = 365 * 3;
const INACTIVE_ACCOUNT_DAYS = 730;
const AFTER_LAST_POSITION_DAYS = 365;
// Each anonymisation is a full erasure; cap the work per nightly run.
const ANONYMISE_PER_RUN = 100;

const DAY_MS = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY_MS);

/**
 * Daily retention sweep — triggered by Vercel Cron hitting
 * /api/cron/retention-sweep.
 */
export async function runRetentionSweep(dryRun = false) {
  const run = await db.syncRun.create({
    data: { kind: `retention-sweep:${dryRun ? "dry" : "apply"}`, status: "RUNNING" },
    select: { id: true },
  });

  const counts: Record<string, number> = {};

  const drafts = { status: "DRAFT" as const, updatedAt: { lt: ago(365) } };
  counts.drafts = dryRun
    ? await db.post.count({ where: drafts })
    : (await db.post.deleteMany({ where: drafts })).count;

  const notifications = { createdAt: { lt: ago(183) } };
  counts.notifications = dryRun
    ? await db.notification.count({ where: notifications })
    : (await db.notification.deleteMany({ where: notifications })).count;

  const emails = { createdAt: { lt: ago(365) } };
  counts.emailDeliveries = dryRun
    ? await db.emailDelivery.count({ where: emails })
    : (await db.emailDelivery.deleteMany({ where: emails })).count;

  // 30 days after a session ended, whether it hit its cap or went idle.
  const sessions = {
    OR: [{ expiresAt: { lt: ago(30) } }, { lastSeenAt: { lt: ago(SESSION_IDLE_DAYS + 30) } }],
  };
  counts.sessions = dryRun
    ? await db.session.count({ where: sessions })
    : (await db.session.deleteMany({ where: sessions })).count;

  const idleTokens = { user: { lastSeenAt: { lt: ago(90) } } };
  counts.oauthTokens = dryRun
    ? await db.oauthToken.count({ where: idleTokens })
    : (await db.oauthToken.deleteMany({ where: idleTokens })).count;

  const syncRuns = { startedAt: { lt: ago(90) } };
  counts.syncRuns = dryRun
    ? await db.syncRun.count({ where: syncRuns })
    : (await db.syncRun.deleteMany({ where: syncRuns })).count;

  const reports = { resolvedAt: { lt: ago(365 * 3) } };
  counts.reports = dryRun
    ? await db.report.count({ where: reports })
    : (await db.report.deleteMany({ where: reports })).count;

  const appeals = { decidedAt: { lt: ago(365 * 3) } };
  counts.appeals = dryRun
    ? await db.appeal.count({ where: appeals })
    : (await db.appeal.deleteMany({ where: appeals })).count;

  const oldAudit = { createdAt: { lt: ago(AUDIT_RETENTION_DAYS) } };
  counts.auditEvents = dryRun
    ? await db.auditEvent.count({ where: oldAudit })
    : (await db.auditEvent.deleteMany({ where: oldAudit })).count;

  const auditContext = {
    createdAt: { lt: ago(AUDIT_CONTEXT_DAYS) },
    OR: [{ ipHash: { not: null } }, { userAgent: { not: null } }],
  };
  counts.auditContextCleared = dryRun
    ? await db.auditEvent.count({ where: auditContext })
    : (
        await db.auditEvent.updateMany({
          where: auditContext,
          data: { ipHash: null, userAgent: null },
        })
      ).count;

  const refused = {
    action: "auth.sign_in_refused",
    targetType: { in: [REFUSED_SIGN_IN_TARGET, LEGACY_REFUSED_SIGN_IN_TARGET] },
    createdAt: { lt: ago(REFUSED_SIGN_IN_DAYS) },
  };
  counts.refusedSignIns = dryRun
    ? await db.auditEvent.count({ where: refused })
    : (await db.auditEvent.deleteMany({ where: refused })).count;

  // Older refusals stored the raw GIS id; re-key them to the keyed reference.
  const legacyRefusals = await db.auditEvent.findMany({
    where: { targetType: LEGACY_REFUSED_SIGN_IN_TARGET },
    select: { id: true, targetId: true },
    take: 1000,
  });
  if (!dryRun) {
    for (const row of legacyRefusals) {
      await db.auditEvent.update({
        where: { id: row.id },
        data: {
          targetType: REFUSED_SIGN_IN_TARGET,
          targetId: pseudonymousRef("refused-sign-in", row.targetId),
        },
      });
    }
  }
  counts.refusedSignInsRekeyed = legacyRefusals.length;

  // A deleted comment's text goes after 30 days; the row goes too unless replies
  // still hang off it, in which case it stays as an empty placeholder.
  const deletedComments = await db.comment.findMany({
    where: { status: "DELETED", deletedAt: { lt: ago(DELETED_COMMENT_DAYS) } },
    select: { id: true, body: true, _count: { select: { replies: true } } },
    take: 1000,
  });
  const removable = deletedComments.filter((c) => c._count.replies === 0).map((c) => c.id);
  const emptied = deletedComments
    .filter((c) => c._count.replies > 0 && c.body !== "")
    .map((c) => c.id);
  if (!dryRun) {
    await db.comment.deleteMany({ where: { id: { in: removable } } });
    await db.comment.updateMany({ where: { id: { in: emptied } }, data: { body: "" } });
  }
  counts.deletedCommentsPurged = removable.length + emptied.length;

  const closedRequests = { completedAt: { lt: ago(PRIVACY_REQUEST_DAYS) } };
  counts.privacyRequests = dryRun
    ? await db.dataSubjectRequest.count({ where: closedRequests })
    : (await db.dataSubjectRequest.deleteMany({ where: closedRequests })).count;
  if (!dryRun) {
    await db.dataSubjectRequest.updateMany({
      where: { completedAt: { not: null }, email: { not: null } },
      data: { email: null },
    });
  }

  counts.accountsAnonymised = await anonymiseInactiveAccounts(dryRun);

  const media = await sweepMedia(dryRun);
  counts.orphanMedia = media.orphanRows;
  counts.storedImagesDeleted = media.objectsDeleted;

  // Deleting raw reads before metrics-rollup exists would destroy
  // measurement that has not been rolled up, so this only reports.
  counts.postReadsEligible = await db.postRead.count({
    where: { lastReadAt: { lt: ago(396) } },
  });

  // Per post: Prisma has no single-statement "latest N per group",
  // so this loops manually.
  const noisy = await db.post.findMany({
    where: { versions: { some: {} } },
    select: { id: true, _count: { select: { versions: true } } },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  let versionsPruned = 0;
  for (const post of noisy.filter((p) => p._count.versions > 50)) {
    const keep = await db.postVersion.findMany({
      where: { postId: post.id },
      orderBy: { version: "desc" },
      take: 50,
      select: { id: true },
    });
    if (dryRun) {
      versionsPruned += post._count.versions - keep.length;
      continue;
    }
    const removed = await db.postVersion.deleteMany({
      where: { postId: post.id, id: { notIn: keep.map((v) => v.id) } },
    });
    versionsPruned += removed.count;
  }

  const summary = { ...counts, postVersions: versionsPruned, dryRun };

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

  logger.info("retention-sweep complete", summary);
  return summary;
}

/**
 * Accounts nobody has used for 24 months, or whose last AIESEC position ended
 * more than a year ago, are anonymised exactly as an erasure request would
 * (content stays, attributed to "Former member").
 */
async function anonymiseInactiveAccounts(dryRun: boolean): Promise<number> {
  const inactiveSince = ago(INACTIVE_ACCOUNT_DAYS);
  const leftBefore = ago(AFTER_LAST_POSITION_DAYS);

  const candidates = await db.user.findMany({
    where: {
      status: { not: "ERASED" },
      OR: [
        { lastSeenAt: { lt: inactiveSince } },
        { lastSeenAt: null, createdAt: { lt: inactiveSince } },
        {
          lastSeenAt: { lt: leftBefore },
          grants: {
            none: { revokedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: leftBefore } }] },
          },
        },
      ],
    },
    select: { id: true },
    take: ANONYMISE_PER_RUN,
  });

  if (dryRun) return candidates.length;

  let anonymised = 0;
  for (const user of candidates) {
    try {
      await executeErasure(user.id, "reattribute", systemActor("retention"));
      anonymised++;
    } catch (error) {
      logger.error("Retention could not anonymise an account", { userId: user.id, error });
    }
  }
  return anonymised;
}

/**
 * The operator-driven DSR export path: a request raised by email, or a
 * subject whose account is suspended and who therefore cannot self-serve.
 * Run by hand via `npm run job dsr-export -- <requestId> <userId>`
 * (scripts/run-job.ts) — there is no scheduled trigger for this one.
 */
export async function runDsrExport(requestId: string, userId: string) {
  const bundle = await buildExportBundle(userId);

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

  return { requestId, ready: true, bundle };
}
