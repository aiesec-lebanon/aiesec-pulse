import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus, QuotaPeriod, ScopeType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { ancestorChain } from "@/lib/org/entities";
import { currentIsoWeek } from "@/lib/week";

// The window is computed, never stored as a counter: the count is a query over
// Post.quotaPeriod, which removes the reset job and the midnight race.

export function quotaPeriodFor(period: QuotaPeriod, at: Date = new Date()): string {
  if (period === QuotaPeriod.CALENDAR_MONTH) {
    return `${at.getUTCFullYear()}-M${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return currentIsoWeek(at);
}

export type ResolvedQuota = {
  policyId: string;
  roleKey: string;
  period: QuotaPeriod;
  maxPosts: number;
  periodLabel: string;
};

/** Nearest scope wins, so an entity can be given a bespoke allowance. */
export async function resolveQuotaPolicy(
  entityId: string | null,
  roleKey: string,
  at: Date = new Date()
): Promise<ResolvedQuota | null> {
  const candidates: Array<{ scopeType: ScopeType; entityId: string | null }> = [];

  if (entityId) {
    const chain = await ancestorChain(entityId);
    for (const entity of [...chain].reverse()) {
      candidates.push({ scopeType: ScopeType.ENTITY, entityId: entity.id });
    }
  }
  candidates.push({ scopeType: ScopeType.GLOBAL, entityId: null });

  for (const candidate of candidates) {
    const policy = await db.quotaPolicy.findFirst({
      where: {
        isActive: true,
        roleKey,
        scopeType: candidate.scopeType,
        entityId: candidate.entityId,
      },
    });
    if (policy) {
      return {
        policyId: policy.id,
        roleKey: policy.roleKey,
        period: policy.period,
        maxPosts: policy.maxPosts,
        periodLabel: quotaPeriodFor(policy.period, at),
      };
    }
  }

  return null;
}

export const QUOTA_CONSUMING_STATUSES = [
  PostStatus.PUBLISHED,
  PostStatus.SCHEDULED,
  PostStatus.IN_REVIEW,
] as const;

// Takes a transaction client so the read-then-write in submitPost stays in one
// serializable transaction.
export async function usedInPeriod(
  client: Prisma.TransactionClient | typeof db,
  authorId: string,
  periodLabel: string
): Promise<number> {
  return client.post.count({
    where: {
      authorId,
      quotaPeriod: periodLabel,
      status: { in: [...QUOTA_CONSUMING_STATUSES] },
    },
  });
}

export type QuotaState = {
  used: number;
  max: number;
  periodLabel: string;
  atLimit: boolean;
  policy: ResolvedQuota | null;
};

export async function quotaStateFor(
  authorId: string,
  entityId: string | null,
  roleKey: string,
  at: Date = new Date()
): Promise<QuotaState> {
  const policy = await resolveQuotaPolicy(entityId, roleKey, at);
  if (!policy) {
    return {
      used: 0,
      max: 0,
      periodLabel: quotaPeriodFor(QuotaPeriod.ISO_WEEK, at),
      atLimit: true,
      policy: null,
    };
  }

  const used = await usedInPeriod(db, authorId, policy.periodLabel);
  return {
    used,
    max: policy.maxPosts,
    periodLabel: policy.periodLabel,
    atLimit: used >= policy.maxPosts,
    policy,
  };
}
