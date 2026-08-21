import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostLevel, PostStatus } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { mcAncestorOf } from "@/lib/org/entities";
import {
  type PromotionPool,
  promotionPoolFor,
  promotionsUsedInPeriod,
  type ResolvedQuota,
  resolveQuotaPolicy,
} from "@/lib/quota";
import { can } from "@/lib/rbac/can";
import { isAiLevelRole, type RoleKey } from "@/lib/rbac/catalogue";

/**
 * How far a post reaches the moment it is published. Two rules.
 *
 * 1. **An AI-level office publishes at `NETWORK` by default.** It sits above
 *    the MC tier, so there is no MC for `LOCAL` to mean anything relative to.
 *    Nothing is spent: no promoter, no note, no window — the same shape the
 *    backfill gave posts that were network-wide before promotion existed.
 *    Promotion is an editorial act on an MC's own output, and an AI office is
 *    not doing that when it simply publishes.
 *
 *    The default holds only while the audience is `GLOBAL`. `NETWORK` reaches
 *    every member whatever a post is targeted at — the visibility query tests
 *    the level first — so an AI office narrowing to a region or an entity would
 *    otherwise have its targeting silently ignored — and `post.target_beyond`
 *    belongs to exactly these three classes. Narrowing keeps the post `LOCAL`,
 *    where `PostAudience` decides who sees it: audience narrows reach and
 *    never widens it.
 *
 * 2. **Everything else starts `LOCAL`, including an MC's own posts**, and
 *    reaches the network only by promotion — which is what makes the quota an
 *    actual cap on network-feed volume. The publisher may spend that promotion
 *    at the moment of publication rather than in a second visit to the post,
 *    but it is the same promotion: same permission, same per-MC budget, same
 *    mandatory note, same audit event.
 */

/** What the composer needs to render, resolved server-side. */
export type ReachOptions =
  /** Reach is settled by position; shown as information, not as a control. */
  | { kind: "network" }
  /** The publisher may spend a promotion at publication. */
  | { kind: "choice"; used: number; max: number; periodLabel: string };

/**
 * The parts of the decision that need no transaction: which level this
 * publisher's posts are born at, and — when that is `LOCAL` — whether they may
 * raise it and against which budget. Resolved before the publish transaction
 * opens, so the only thing left inside it is the count that must not race.
 */
export type ReachContext = {
  defaultLevel: PostLevel;
  promotion: { pool: PromotionPool; policy: ResolvedQuota } | null;
};

export async function reachContextFor(
  user: { id: string; primaryEntityId: string | null },
  publisherEntityId: string,
  roleKey: RoleKey,
  /** Whether the post is aimed at everyone. False once the publisher narrows it. */
  globalAudience = true
): Promise<ReachContext> {
  if (isAiLevelRole(roleKey)) {
    return {
      defaultLevel: globalAudience ? PostLevel.NETWORK : PostLevel.LOCAL,
      promotion: null,
    };
  }

  const local = { defaultLevel: PostLevel.LOCAL, promotion: null } as const;
  if (!(await can(user, "post.promote", { type: "ENTITY", entityId: publisherEntityId }))) {
    return local;
  }

  const actorMc = user.primaryEntityId ? await mcAncestorOf(user.primaryEntityId) : null;
  const policy = await resolveQuotaPolicy(actorMc?.id ?? null, roleKey, PostLevel.NETWORK);
  if (!policy) return local;

  return {
    defaultLevel: PostLevel.LOCAL,
    promotion: { pool: promotionPoolFor(user.id, actorMc), policy },
  };
}

/** The composer's view of the same context. Absent means "no control to show". */
export async function reachOptionsFor(
  user: { id: string; primaryEntityId: string | null },
  publisherEntityId: string,
  roleKey: RoleKey
): Promise<ReachOptions | undefined> {
  // Asked without an audience, because the composer has not been filled in yet:
  // the `network` shape is the AI default, and the picker says what narrowing
  // the audience does to it.
  const context = await reachContextFor(user, publisherEntityId, roleKey);
  if (context.defaultLevel === PostLevel.NETWORK) return { kind: "network" };
  if (!context.promotion) return undefined;

  const { pool, policy } = context.promotion;
  return {
    kind: "choice",
    used: await promotionsUsedInPeriod(db, pool, policy.periodLabel),
    max: policy.maxPosts,
    periodLabel: policy.periodLabel,
  };
}

/** The columns a promotion stamps onto the post, or nothing when none was spent. */
export type PromotionStamp = {
  promotedById: string;
  promotedAt: Date;
  promotionNote: string;
  promotionPeriod: string;
};

export type ReachDecision =
  | { ok: true; level: PostLevel; stamp: PromotionStamp | null }
  | { ok: false; error: string; field: "promotionNote" | "_form" };

/**
 * The half that must run inside the publish transaction: whether the requested
 * promotion can be paid for, decided against a count taken under the same
 * Serializable snapshot as the publish itself. Two officers of one MC
 * publishing at once cannot both read the same "one left" and both spend it.
 *
 * Returns a refusal rather than throwing, so the caller can leave the
 * transaction without having written anything.
 */
export async function decideReach(
  tx: Prisma.TransactionClient,
  context: ReachContext,
  actorId: string,
  status: PostStatus,
  requested: { promoteToNetwork: boolean; note: string | undefined }
): Promise<ReachDecision> {
  if (context.defaultLevel === PostLevel.NETWORK || !requested.promoteToNetwork) {
    return { ok: true, level: context.defaultLevel, stamp: null };
  }

  if (!context.promotion) {
    return {
      ok: false,
      error: "You cannot promote a post to the whole network.",
      field: "_form",
    };
  }

  // A queued post reaches nobody, so there is nothing to promote and no reason
  // to spend a window on it. Nothing unpublished can be promoted; a scheduled
  // post is on its way there and keeps the choice, the same call the publishing
  // quota already makes.
  if (status === PostStatus.IN_REVIEW) {
    return {
      ok: false,
      error:
        "This post is over your publishing quota and goes to the approval queue, " +
        "so it cannot be promoted yet. Publish it first, then promote it.",
      field: "_form",
    };
  }

  const note = requested.note?.trim();
  if (!note || note.length < 5) {
    return {
      ok: false,
      error: "Say why the network should see this — at least 5 characters.",
      field: "promotionNote",
    };
  }

  const { pool, policy } = context.promotion;
  const used = await promotionsUsedInPeriod(tx, pool, policy.periodLabel);
  if (used >= policy.maxPosts) {
    return {
      ok: false,
      error: `Your MC has used all ${policy.maxPosts} promotions for ${policy.periodLabel}.`,
      field: "_form",
    };
  }

  return {
    ok: true,
    level: PostLevel.NETWORK,
    stamp: {
      promotedById: actorId,
      promotedAt: new Date(),
      promotionNote: note,
      promotionPeriod: policy.periodLabel,
    },
  };
}
