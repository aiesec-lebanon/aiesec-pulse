import "server-only";

import { ActorType } from "@/app/generated/prisma/enums";
import { recordAudit, systemActor } from "@/lib/audit";
import { revokeAllSessions } from "@/lib/auth/session";
import { pseudonymise } from "@/lib/crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// Erasure has to reconcile with an append-only audit log: actorId is nulled and
// actorLabel becomes a salted pseudonym, so the events stay and the person goes.

export const DSR_SLA_DAYS = 30;

export type DsrKind = "ACCESS" | "EXPORT" | "RECTIFICATION" | "ERASURE" | "OBJECTION";
export type DsrStatus = "RECEIVED" | "IN_PROGRESS" | "COMPLETED" | "REFUSED";

export async function openRequest(input: {
  userId: string | null;
  email: string | null;
  kind: DsrKind;
  notes?: string;
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
    { kind: input.kind, dueAt: dueAt.toISOString() }
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

  const [posts, comments, reactions, bookmarks, reads, notifications, sessions, auditRefs] =
    await Promise.all([
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
    ]);

  return {
    generatedAt: new Date().toISOString(),
    subject: {
      aiesecPersonId: user.aiesecPersonId,
      fullName: user.fullName,
      email: user.email,
      locale: user.locale,
      timezone: user.timezone,
      status: user.status,
      entity: user.primaryEntity,
      memberSince: user.createdAt,
      lastSeenAt: user.lastSeenAt,
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
    auditReferences: auditRefs,
    notes:
      "Audit references list actions you took. The audit log itself is retained for 7 years as an organisational record; on erasure your identity is removed from it while the events remain. See /legal/privacy.",
  };
}

export type ErasureChoice = "reattribute" | "remove";

export async function executeErasure(
  userId: string,
  choice: ErasureChoice,
  actor: { id: string; label: string }
): Promise<{ postsAffected: number; commentsAffected: number; auditRowsPseudonymised: number }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, aiesecPersonId: true, fullName: true },
  });
  if (!user) throw new Error(`No such user: ${userId}`);

  const pseudonym = pseudonymise(user.aiesecPersonId);

  const result = await db.$transaction(async (tx) => {
    let postsAffected = 0;
    let commentsAffected = 0;

    if (choice === "remove") {
      const posts = await tx.post.updateMany({
        where: { authorId: userId },
        data: { status: "ARCHIVED", archivedAt: new Date(), bodyText: "", summary: null },
      });
      postsAffected = posts.count;
      const comments = await tx.comment.updateMany({
        where: { userId },
        data: { status: "DELETED", deletedAt: new Date(), body: "" },
      });
      commentsAffected = comments.count;
    } else {
      postsAffected = await tx.post.count({ where: { authorId: userId } });
      commentsAffected = await tx.comment.count({ where: { userId } });
    }

    await tx.postRead.deleteMany({ where: { userId } });
    await tx.bookmark.deleteMany({ where: { userId } });
    await tx.follow.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.emailDelivery.deleteMany({ where: { userId } });
    await tx.oauthToken.deleteMany({ where: { userId } });
    await tx.userDigestSetting.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });

    await tx.roleGrant.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const audit = await tx.auditEvent.updateMany({
      where: { actorId: userId },
      data: { actorId: null, actorLabel: pseudonym, ipHash: null, userAgent: null },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        status: "ERASED",
        erasedAt: new Date(),
        aiesecPersonId: pseudonym,
        fullName: "Former member",
        email: null,
        avatarUrl: null,
        lastSeenAt: null,
      },
    });

    return { postsAffected, commentsAffected, auditRowsPseudonymised: audit.count };
  });

  await revokeAllSessions(userId);

  await recordAudit(
    { type: ActorType.USER, id: actor.id, label: actor.label },
    "privacy.erasure_executed",
    { type: "user", id: userId },
    { choice, ...result }
  );

  logger.warn("GDPR erasure executed", { userId, choice, ...result });
  return result;
}
