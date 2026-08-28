import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostLevel, PostStatus, QuotaPeriod, ScopeType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { ancestorPaths, depthOf } from "@/lib/org/path";
import { type PermissionKey, ROLE_KEYS, type RoleKey } from "@/lib/rbac/catalogue";
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
  postLevel: PostLevel;
  period: QuotaPeriod;
  maxPosts: number;
  periodLabel: string;
};

/**
 * Nearest scope wins, so an entity can be given a bespoke allowance.
 *
 * An ancestor's path prefixes its descendant's, so "nearest" means "deepest".
 * A GLOBAL policy has no entity, hence depth 0 — behind every entity-scoped
 * row, as the fallback.
 */
export function nearestByScope<T extends { entityId: string | null }>(
  policies: T[],
  depthByEntityId: ReadonlyMap<string, number>
): T | null {
  let nearest: T | null = null;
  let nearestDepth = -1;

  for (const policy of policies) {
    // `> nearestDepth`, never `>=`, so the first row wins ties — matching the
    // legacy per-scope `findFirst` behaviour.
    const depth = policy.entityId ? (depthByEntityId.get(policy.entityId) ?? 0) : 0;
    if (depth > nearestDepth) {
      nearest = policy;
      nearestDepth = depth;
    }
  }

  return nearest;
}

/**
 * `postLevel` picks between a role's two budgets: LOCAL for posts published
 * into its own MC, NETWORK for promotions to the whole network — separate
 * policy rows at the same scope, so level must be passed explicitly, never
 * inferred.
 */
export async function resolveQuotaPolicy(
  entityId: string | null,
  roleKey: string,
  postLevel: PostLevel,
  at: Date = new Date()
): Promise<ResolvedQuota | null> {
  // Precedence lives in nearestByScope, not in query order.
  const entity = entityId
    ? await db.entity.findUnique({ where: { id: entityId }, select: { path: true } })
    : null;

  // Ancestors *and* the entity itself — ancestorPaths is strict, and a policy
  // set on the author's own entity is the nearest scope there is.
  const chainPaths = entity ? [...ancestorPaths(entity.path), entity.path] : [];

  const [chain, policies] = await Promise.all([
    chainPaths.length > 0
      ? db.entity.findMany({
          where: { path: { in: chainPaths } },
          select: { id: true, path: true },
        })
      : [],
    db.quotaPolicy.findMany({
      where: {
        isActive: true,
        roleKey,
        postLevel,
        OR: [
          { scopeType: ScopeType.GLOBAL, entityId: null },
          ...(chainPaths.length > 0
            ? [{ scopeType: ScopeType.ENTITY, entity: { path: { in: chainPaths } } }]
            : []),
        ],
      },
    }),
  ]);

  const depthByEntityId = new Map(chain.map((row) => [row.id, depthOf(row.path)]));

  const policy = nearestByScope(policies, depthByEntityId);
  if (!policy) return null;

  return {
    policyId: policy.id,
    roleKey: policy.roleKey,
    postLevel: policy.postLevel,
    period: policy.period,
    maxPosts: policy.maxPosts,
    periodLabel: quotaPeriodFor(policy.period, at),
  };
}

/**
 * Which classes need a budget at each level: those holding the permission that
 * spends it. A class with the permission but no policy can't publish or
 * promote at all — a missing policy reads as at-limit, not unlimited.
 */
export const SPENDING_PERMISSION: Record<PostLevel, PermissionKey> = {
  [PostLevel.LOCAL]: "post.publish",
  [PostLevel.NETWORK]: "post.promote",
};

export function rolesSpendingAt(
  level: PostLevel,
  matrix: Record<RoleKey, readonly PermissionKey[]>
): RoleKey[] {
  return ROLE_KEYS.filter((role) => matrix[role].includes(SPENDING_PERMISSION[level]));
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
  const policy = await resolveQuotaPolicy(entityId, roleKey, PostLevel.LOCAL, at);
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

/**
 * The pool a promotion is billed against. The NETWORK budget counts per MC,
 * not per officer, so an MC can't buy extra network reach by spreading
 * promotions across several MCVPs. A promoter above the MC tier shares an MC
 * with nobody, so their pool is themselves — the same rule, not an exception.
 */
export type PromotionPool = { mcPath: string } | { promoterId: string };

export function promotionPoolFor(promoterId: string, mc: { path: string } | null): PromotionPool {
  return mc ? { mcPath: mc.path } : { promoterId };
}

/**
 * Counted on `promotionPeriod` alone — deliberately **not** also on
 * `level = NETWORK`. Including it would let demotion refund the promotion: the
 * window's spend stands whether or not it's later withdrawn, or promote/demote
 * cycling becomes an unbounded reach budget.
 *
 * `excludePostId` excludes the promoted post from its own count, so
 * re-promoting something this window already paid for is free, but a second
 * post is not. Omit it to ask what the pool has actually spent — the number a
 * budget label should show, since two posts in one MC must report the same
 * remaining budget.
 */
export function promotionCountWhere(
  pool: PromotionPool,
  periodLabel: string,
  excludePostId?: string
): Prisma.PostWhereInput {
  return {
    promotionPeriod: periodLabel,
    ...(excludePostId ? { id: { not: excludePostId } } : {}),
    ...("mcPath" in pool
      ? {
          promotedBy: {
            primaryEntity: {
              // Segment-boundary aware, so /ai/r/lb never matches /ai/r/lbx.
              OR: [{ path: pool.mcPath }, { path: { startsWith: `${pool.mcPath}/` } }],
            },
          },
        }
      : { promotedById: pool.promoterId }),
  };
}

export async function promotionsUsedInPeriod(
  client: Prisma.TransactionClient | typeof db,
  pool: PromotionPool,
  periodLabel: string,
  excludePostId?: string
): Promise<number> {
  return client.post.count({ where: promotionCountWhere(pool, periodLabel, excludePostId) });
}
