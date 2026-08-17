import "server-only";

import { headers } from "next/headers";

import type { Prisma } from "@/app/generated/prisma/client";
import { ActorType } from "@/app/generated/prisma/enums";
import { hashIp } from "@/lib/crypto";
import { db } from "@/lib/db";
import { logger, newCorrelationId } from "@/lib/logger";

// The wrapped work runs first and the event is written only after it
// succeeds, so a failed action leaves no row claiming it happened. A failed
// audit write is logged but does not fail the action.

export type AuditActor = {
  type: ActorType;
  id?: string | null;
  label?: string | null;
};

export type AuditTarget = {
  type: string;
  id: string;
  entityId?: string | null;
};

async function requestContext(): Promise<{ ipHash: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0]?.trim() : h.get("x-real-ip");
    return { ipHash: hashIp(ip), userAgent: h.get("user-agent")?.slice(0, 500) ?? null };
  } catch {
    return { ipHash: null, userAgent: null };
  }
}

export async function recordAudit(
  actor: AuditActor,
  action: string,
  target: AuditTarget,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  const { ipHash, userAgent } = await requestContext();
  await db.auditEvent.create({
    data: {
      actorType: actor.type,
      actorId: actor.id ?? null,
      actorLabel: actor.label ?? null,
      action,
      targetType: target.type,
      targetId: target.id,
      entityId: target.entityId ?? null,
      ipHash,
      userAgent,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function withAudit<T>(
  actor: AuditActor,
  action: string,
  target: AuditTarget,
  metadata: Record<string, unknown> | null,
  fn: () => Promise<T>
): Promise<T> {
  const correlationId = newCorrelationId();
  const result = await fn();

  try {
    await recordAudit(actor, action, target, { ...(metadata ?? {}), correlationId });
  } catch (error) {
    logger.error("Audit write failed after the action succeeded", {
      action,
      targetType: target.type,
      targetId: target.id,
      correlationId,
      error,
    });
  }

  return result;
}

export function userActor(user: { id: string; fullName: string }): AuditActor {
  return { type: ActorType.USER, id: user.id, label: user.fullName };
}

export function systemActor(label: string): AuditActor {
  return { type: ActorType.SYSTEM, id: null, label };
}

export function breakGlassActor(session: { adminId: string; email: string }): AuditActor {
  return { type: ActorType.BREAK_GLASS, id: session.adminId, label: session.email };
}
