import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import {
  type AuditActor,
  LEGACY_REFUSED_SIGN_IN_TARGET,
  recordAudit,
  systemActor,
} from "@/lib/audit";
import { revokeAllSessions } from "@/lib/auth/session";
import { EMPTY_DOCUMENT } from "@/lib/content/document";
import { erasurePseudonym } from "@/lib/crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// Erasure has to reconcile with the audit log: actorId is nulled and the
// person's name, email and GIS id are replaced by a random pseudonym, so the
// events stay and the person goes.

export const DSR_SLA_DAYS = 30;

export type DsrKind =
  | "QUESTION"
  | "ACCESS"
  | "EXPORT"
  | "RECTIFICATION"
  | "ERASURE"
  | "RESTRICTION"
  | "OBJECTION";
export type DsrStatus = "RECEIVED" | "IN_PROGRESS" | "COMPLETED" | "REFUSED";

/** Where a request came from; the contact form's are throttled from the audit log. */
export type DsrChannel = "settings" | "contact_form";

export async function openRequest(input: {
  userId: string | null;
  email: string | null;
  kind: DsrKind;
  notes?: string;
  channel?: DsrChannel;
}): Promise<string> {
  const dueAt = new Date(Date.now() + DSR_SLA_DAYS * 24 * 60 * 60 * 1000);
  const request = await db.dataSubjectRequest.create({
    data: {
      userId: input.userId,
      email: input.email,
      kind: input.kind,
      dueAt,
      notes: input.notes ?? null,
    },
    select: { id: true },
  });

  await recordAudit(
    systemActor("privacy"),
    "dsr.received",
    { type: "data_subject_request", id: request.id },
    { kind: input.kind, dueAt: dueAt.toISOString(), channel: input.channel ?? "settings" }
  );

  return request.id;
}

export async function buildExportBundle(userId: string): Promise<Record<string, unknown>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      primaryEntity: { select: { name: true, tag: true, path: true } },
      grants: {
        select: {
          role: { select: { key: true, name: true } },
          scopeType: true,
          scope: { select: { name: true } },
          termLabel: true,
          startsAt: true,
          endsAt: true,
          revokedAt: true,
          source: true,
        },
      },
      digestSetting: true,
      notificationPrefs: true,
    },
  });
  if (!user) throw new Error(`No such user: ${userId}`);

  const [
    posts,
    comments,
    reactions,
    bookmarks,
    reads,
    notifications,
    sessions,
    auditRefs,
    follows,
    media,
    postVersions,
    acknowledgements,
    reportsFiled,
    appeals,
    restrictions,
    privacyRequests,
  ] = await Promise.all([
    db.post.findMany({
      where: { authorId: userId },
      select: {
        slug: true,
        title: true,
        summary: true,
        bodyText: true,
        status: true,
        createdAt: true,
        publishedAt: true,
        publisher: { select: { name: true } },
      },
    }),
    db.comment.findMany({
      where: { userId },
      select: {
        body: true,
        status: true,
        createdAt: true,
        post: { select: { slug: true, title: true } },
      },
    }),
    db.reaction.findMany({
      where: { userId },
      select: { kind: true, createdAt: true, post: { select: { slug: true, title: true } } },
    }),
    db.bookmark.findMany({
      where: { userId },
      select: { createdAt: true, post: { select: { slug: true, title: true } } },
    }),
    db.postRead.findMany({
      where: { userId },
      select: {
        firstReadAt: true,
        lastReadAt: true,
        dwellMs: true,
        scrollPct: true,
        source: true,
        post: { select: { slug: true, title: true } },
      },
    }),
    db.notification.findMany({
      where: { userId },
      select: { kind: true, payload: true, readAt: true, createdAt: true },
    }),
    db.session.findMany({
      where: { userId },
      // Withheld: a keyed hash of a network address is disclosure without value.
      select: {
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    }),
    db.auditEvent.findMany({
      where: { actorId: userId },
      select: { action: true, targetType: true, targetId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.follow.findMany({
      where: { userId },
      select: { targetType: true, targetId: true, muted: true, createdAt: true },
    }),
    db.media.findMany({
      where: { ownerId: userId },
      select: {
        path: true,
        mimeType: true,
        bytes: true,
        width: true,
        height: true,
        altText: true,
        createdAt: true,
      },
    }),
    db.postVersion.findMany({
      where: { editedById: userId },
      select: {
        version: true,
        title: true,
        summary: true,
        bodyJson: true,
        changeNote: true,
        createdAt: true,
        post: { select: { slug: true } },
      },
    }),
    db.acknowledgement.findMany({
      where: { userId },
      select: { acknowledgedAt: true, post: { select: { slug: true, title: true } } },
    }),
    db.report.findMany({
      where: { reporterId: userId },
      select: {
        targetType: true,
        reason: true,
        details: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
      },
    }),
    db.appeal.findMany({
      where: { appellantId: userId },
      select: {
        targetType: true,
        rationale: true,
        status: true,
        createdAt: true,
        decidedAt: true,
      },
    }),
    db.userRestriction.findMany({
      where: { userId },
      select: { kind: true, reason: true, startsAt: true, endsAt: true },
    }),
    db.dataSubjectRequest.findMany({
      where: { userId },
      select: {
        kind: true,
        status: true,
        receivedAt: true,
        dueAt: true,
        completedAt: true,
        notes: true,
      },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    subject: {
      aiesecPersonId: user.aiesecPersonId,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      locale: user.locale,
      timezone: user.timezone,
      status: user.status,
      entity: user.primaryEntity,
      memberSince: user.createdAt,
      lastSeenAt: user.lastSeenAt,
      lastSyncedAt: user.lastSyncedAt,
    },
    roleGrants: user.grants,
    preferences: {
      digest: user.digestSetting,
      notifications: user.notificationPrefs,
    },
    posts,
    comments,
    reactions,
    bookmarks,
    reads,
    notifications,
    sessions,
    follows,
    uploadedImages: media,
    postVersions,
    acknowledgements,
    reportsFiled,
    appeals,
    restrictions,
    privacyRequests,
    auditReferences: auditRefs,
    notes:
      "Audit references list actions you took. The audit log is kept for 24 months; on erasure your identity is removed from it while the events remain. See /legal/privacy.",
  };
}

export type ErasureChoice = "reattribute" | "remove";

export type ErasureResult = {
  postsAffected: number;
  commentsAffected: number;
  auditRowsPseudonymised: number;
};

// JSON-escaped so it matches the value as it appears inside jsonb text.
function asJsonText(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

/**
 * Every relation of User must be handled here; ERASURE_COVERAGE (erasure-coverage.ts) records
 * how, and a unit test fails when the schema gains one it does not list.
 */
export async function executeErasure(
  userId: string,
  choice: ErasureChoice,
  actor: AuditActor
): Promise<ErasureResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, aiesecPersonId: true, fullName: true, email: true },
  });
  if (!user) throw new Error(`No such user: ${userId}`);

  const pseudonym = erasurePseudonym();

  // Revoked first, so no request in flight keeps a session the rows below drop.
  await revokeAllSessions(userId);

  const result = await db.$transaction(async (tx) => {
    const now = new Date();
    let postsAffected = 0;
    let commentsAffected = 0;

    if (choice === "remove") {
      const postIds = (
        await tx.post.findMany({ where: { authorId: userId }, select: { id: true } })
      ).map((p) => p.id);

      await tx.postVersion.deleteMany({ where: { postId: { in: postIds } } });
      await tx.postMedia.deleteMany({ where: { postId: { in: postIds } } });
      await tx.eventDetail.deleteMany({ where: { postId: { in: postIds } } });
      const posts = await tx.post.updateMany({
        where: { authorId: userId },
        data: {
          status: "ARCHIVED",
          archivedAt: now,
          title: "Removed",
          titleAccent: null,
          summary: null,
          bodyJson: EMPTY_DOCUMENT as unknown as Prisma.InputJsonValue,
          bodyText: "",
          linkUrl: null,
          coverMediaId: null,
        },
      });
      postsAffected = posts.count;
      const comments = await tx.comment.updateMany({
        where: { userId },
        data: { status: "DELETED", deletedAt: now, body: "" },
      });
      commentsAffected = comments.count;
    } else {
      postsAffected = await tx.post.count({ where: { authorId: userId } });
      commentsAffected = await tx.comment.count({ where: { userId } });
    }

    // Reaction counts are denormalised onto posts; keep them true.
    const reactions = await tx.reaction.groupBy({
      by: ["postId"],
      where: { userId },
      _count: { _all: true },
    });
    await tx.reaction.deleteMany({ where: { userId } });
    for (const r of reactions) {
      await tx.post.updateMany({
        where: { id: r.postId },
        data: { reactionCount: { decrement: r._count._all } },
      });
    }

    await tx.acknowledgement.deleteMany({ where: { userId } });
    await tx.commentMention.deleteMany({ where: { userId } });
    await tx.postRead.deleteMany({ where: { userId } });
    await tx.bookmark.deleteMany({ where: { userId } });
    await tx.follow.deleteMany({ where: { userId } });
    // Other members' follows of this person point at an id that names no one now.
    await tx.follow.deleteMany({ where: { targetType: "USER", targetId: userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.emailDelivery.deleteMany({ where: { userId } });
    await tx.oauthToken.deleteMany({ where: { userId } });
    await tx.userDigestSetting.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });

    // Images stay only while a remaining post uses them; the retention sweep
    // deletes unreferenced rows and their stored files.
    await tx.media.updateMany({ where: { ownerId: userId }, data: { ownerId: null } });

    await tx.roleGrant.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });

    const audit = await tx.auditEvent.updateMany({
      where: { actorId: userId },
      data: { actorId: null, actorLabel: pseudonym, ipHash: null, userAgent: null },
    });
    await tx.auditEvent.updateMany({
      where: { targetType: LEGACY_REFUSED_SIGN_IN_TARGET, targetId: user.aiesecPersonId },
      data: { targetId: pseudonym },
    });
    for (const needle of [user.fullName, user.email, user.aiesecPersonId]) {
      if (!needle || needle.length < 3) continue;
      const text = asJsonText(needle);
      await tx.$executeRaw`
        UPDATE "AuditEvent"
        SET "metadata" = replace("metadata"::text, ${text}, ${pseudonym})::jsonb
        WHERE "metadata" IS NOT NULL AND strpos("metadata"::text, ${text}) > 0`;
    }

    await tx.dataSubjectRequest.updateMany({ where: { userId }, data: { email: null } });

    await tx.user.update({
      where: { id: userId },
      data: {
        status: "ERASED",
        erasedAt: now,
        aiesecPersonId: pseudonym,
        fullName: "Former member",
        email: null,
        avatarUrl: null,
        bio: null,
        lastSeenAt: null,
        lastSyncedAt: null,
      },
    });

    return { postsAffected, commentsAffected, auditRowsPseudonymised: audit.count };
  });

  await recordAudit(
    actor,
    "privacy.erasure_executed",
    { type: "user", id: userId },
    { choice, ...result }
  );

  logger.warn("GDPR erasure executed", { userId, choice, ...result });
  return result;
}
