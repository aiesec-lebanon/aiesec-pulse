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
 * Reach at publish. AI-level offices default to `NETWORK` (no MC for
 * `LOCAL` to mean anything) — but only while audience is `GLOBAL`;
 * narrowing keeps it `LOCAL`, no promotion spent. Everyone else starts
 * `LOCAL` and only reaches the network via promotion (same permission,
 * per-MC budget, note, and audit event as any other promotion).
 */

/** What the composer needs to render, resolved server-side. */
export type ReachOptions =
  /** Reach is settled by position; shown as information, not as a control. */
  | { kind: "network" }
  /** The publisher may spend a promotion at publication. */
  | { kind: "choice"; used: number; max: number; periodLabel: string };

/**
 * The transaction-free part of the decision: default level and, if `LOCAL`,
 * whether/against which budget it may be promoted. Resolved before the
 * publish transaction opens — only the racy count is left inside it.
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
 * Runs inside the publish transaction: whether the promotion can be paid
 * for, counted under the same Serializable snapshot as the publish so two
 * officers can't both spend the last slot. Returns a refusal rather than
 * throwing, so the caller can exit the transaction cleanly.
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

  // A queued post reaches nobody, so nothing to promote yet. Scheduled
  // posts still keep the choice — same call the publishing quota makes.
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
