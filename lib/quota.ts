import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostLevel, PostStatus, QuotaPeriod, ScopeType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { ancestorPaths, depthOf } from "@/lib/org/path";
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
 * Every candidate sits on one chain from the root down to the author's entity,
 * and an ancestor's path is a prefix of its descendant's — so "nearest" is
 * simply "deepest". A GLOBAL policy has no entity and so no depth, which puts it
 * behind every entity-scoped row: it is the fallback, and depth 0 says exactly
 * that.
 */
export function nearestByScope<T extends { entityId: string | null }>(
  policies: T[],
  depthByEntityId: ReadonlyMap<string, number>
): T | null {
  let nearest: T | null = null;
  let nearestDepth = -1;

  for (const policy of policies) {
    // `> nearestDepth`, never `>=`, so the first row wins a tie — the same
    // arbitrary-but-stable choice the previous per-scope `findFirst` made when
    // one scope held policies for more than one period.
    const depth = policy.entityId ? (depthByEntityId.get(policy.entityId) ?? 0) : 0;
    if (depth > nearestDepth) {
      nearest = policy;
      nearestDepth = depth;
    }
  }

  return nearest;
}

/**
 * Nearest scope wins, so an entity can be given a bespoke allowance.
 *
 * `postLevel` picks between the two budgets a role carries: LOCAL is how many
 * posts it may publish into its own MC, NETWORK how many it may promote to the
 * whole network (context.md §8.4). They are separate policy rows at the same
 * scope, so the level is part of the question, never inferred.
 */
export async function resolveQuotaPolicy(
  entityId: string | null,
  roleKey: string,
  postLevel: PostLevel,
  at: Date = new Date()
): Promise<ResolvedQuota | null> {
  // This used to walk the candidate scopes with one `findFirst` each, stopping
  // at the first hit. For an LC author falling through to the seeded GLOBAL
  // default — the ordinary case — that was six sequential round trips before an
  // answer, and it runs twice per publish: once for the composer's quota state,
  // once inside createPost. Against a remote database that is most of a second
  // of the publish budget spent on configuration lookup.
  //
  // Two round trips now, whatever the depth of the tree. Precedence moves out of
  // the query order and into nearestByScope, where it is explicit and testable.
  const entity = entityId
    ? await db.entity.findUnique({ where: { id: entityId }, select: { path: true } })
    : null;

  // Ancestors *and* the entity itself — ancestorPaths is strict, and a policy
  // set on the author's own entity is the nearest scope there is.
  const chainPaths = entity ? [...ancestorPaths(entity.path), entity.path] : [];

  // Neither of these needs the other's answer, so they go together and the pair
  // costs one round trip rather than two. Both are keyed on the same paths: the
  // policy query filters through the relation, which Prisma compiles to a join
  // in the one statement — asking for the related row with `include` instead
  // would add a second, sequential query just to hydrate it.
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
 * The pool a promotion is billed against. context.md §8.4: the NETWORK budget
 * is counted per MC, not per officer, so an MC cannot buy extra network reach
 * by spreading promotions across several MCVPs. A promoter above the MC tier
 * shares an MC with nobody, so their pool is themselves — the same rule, not an
 * exception to it.
 */
export type PromotionPool = { mcPath: string } | { promoterId: string };

export function promotionPoolFor(promoterId: string, mc: { path: string } | null): PromotionPool {
  return mc ? { mcPath: mc.path } : { promoterId };
}

/**
 * How much of the window's promotion budget the pool has already spent.
 *
 * Counted on `promotionPeriod` alone — deliberately **not** also on
 * `level = NETWORK`, which architecture.md §8.6's illustrative SQL adds.
 * Including it would make demotion refund the promotion, and §8.6's own prose
 * (and the `@@index([promotedById, promotionPeriod])` it specifies) says the
 * opposite: the window's promotion is spent whether or not it is later
 * withdrawn, or promote/demote cycling becomes an unbounded reach budget.
 *
 * The post being promoted is excluded from its own count, so re-promoting
 * something this window already paid for is free while a second post is not.
 */
export async function promotionsUsedInPeriod(
  client: Prisma.TransactionClient | typeof db,
  pool: PromotionPool,
  periodLabel: string,
  excludePostId: string
): Promise<number> {
  return client.post.count({
    where: {
      promotionPeriod: periodLabel,
      id: { not: excludePostId },
      ...("mcPath" in pool
        ? {
            promotedBy: {
              primaryEntity: {
                OR: [{ path: pool.mcPath }, { path: { startsWith: `${pool.mcPath}/` } }],
              },
            },
          }
        : { promotedById: pool.promoterId }),
    },
  });
}
