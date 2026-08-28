"use server";

import { revalidatePath } from "next/cache";

import { EntityKind, PostLevel, QuotaPeriod, ScopeType } from "@/app/generated/prisma/enums";
import { adminActor, withAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { type EntitySearchResult, searchEntitiesByName } from "@/lib/org/entities";
import { parseBudget } from "@/lib/quota-shared";
import { ROLE_KEYS, type RoleKey } from "@/lib/rbac/catalogue";
import { checkAdmin } from "@/lib/rbac/guards";

// Nothing caches a quota policy: resolveQuotaPolicy reads the table on every
// publish, so a saved budget is live on the next post rather than after a TTL.

export type QuotaResult = { ok: true } | { ok: false; error: string };

export type QuotaInput = {
  roleKey: string;
  postLevel: string;
  /** Null administers the network-wide default; an id administers one MC. */
  entityId: string | null;
  period: string;
  maxPosts: number;
};

function isRoleKey(key: string): key is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(key);
}

function isPostLevel(value: string): value is PostLevel {
  return value === PostLevel.LOCAL || value === PostLevel.NETWORK;
}

function isPeriod(value: string): value is QuotaPeriod {
  return value === QuotaPeriod.ISO_WEEK || value === QuotaPeriod.CALENDAR_MONTH;
}

/**
 * One policy per scope/class/level, never per period too — the unique key
 * doesn't include period, so a monthly row beside a weekly one would leave
 * two competing policies. Changing the period rewrites the row instead.
 */
export async function setQuotaPolicy(input: QuotaInput): Promise<QuotaResult> {
  const authorised = await checkAdmin();
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const { roleKey, postLevel, period, entityId } = input;
  if (!isRoleKey(roleKey)) return { ok: false, error: "Unknown position class." };
  if (!isPostLevel(postLevel)) return { ok: false, error: "Unknown post level." };
  if (!isPeriod(period)) return { ok: false, error: "Unknown period." };

  const maxPosts = parseBudget(input.maxPosts);
  if (maxPosts === null) {
    return { ok: false, error: "A budget is a whole number between 0 and 500." };
  }

  // Overrides are scoped to an MC only — network budget pools per MC, and a
  // local budget on an MC already reaches every LC beneath it (ancestor walk).
  if (entityId) {
    const entity = await db.entity.findUnique({
      where: { id: entityId },
      select: { kind: true, isActive: true },
    });
    if (!entity || !entity.isActive || entity.kind !== EntityKind.MC) {
      return { ok: false, error: "Overrides are set on an MC." };
    }
  }

  const scopeType = entityId ? ScopeType.ENTITY : ScopeType.GLOBAL;
  const existing = await db.quotaPolicy.findFirst({
    where: { scopeType, entityId, roleKey, postLevel },
    select: { id: true },
  });

  return withAudit(
    adminActor(authorised.admin),
    "quota.configured",
    { type: "quota_policy", id: existing?.id ?? `${roleKey}:${postLevel}`, entityId },
    { roleKey, postLevel, period, maxPosts, scope: entityId ?? "GLOBAL" },
    async () => {
      if (existing) {
        await db.quotaPolicy.update({
          where: { id: existing.id },
          data: { period, maxPosts, isActive: true },
        });
      } else {
        await db.quotaPolicy.create({
          data: { scopeType, entityId, roleKey, postLevel, period, maxPosts },
        });
      }

      revalidatePath("/admin/quotas");
      return { ok: true as const };
    }
  );
}

/**
 * Returns the MC to the network default. A default itself can't be removed
 * — nothing sits behind it, and a class with no policy anywhere can't publish.
 */
export async function removeQuotaOverride(policyId: string): Promise<QuotaResult> {
  const authorised = await checkAdmin();
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const policy = await db.quotaPolicy.findUnique({
    where: { id: policyId },
    select: { id: true, scopeType: true, entityId: true, roleKey: true, postLevel: true },
  });
  if (!policy) return { ok: false, error: "That override no longer exists." };
  if (policy.scopeType !== ScopeType.ENTITY) {
    return { ok: false, error: "A network-wide default cannot be removed, only changed." };
  }

  return withAudit(
    adminActor(authorised.admin),
    "quota.override_removed",
    { type: "quota_policy", id: policy.id, entityId: policy.entityId },
    { roleKey: policy.roleKey, postLevel: policy.postLevel },
    async () => {
      await db.quotaPolicy.delete({ where: { id: policy.id } });
      revalidatePath("/admin/quotas");
      return { ok: true as const };
    }
  );
}

/**
 * Backs the override form's MC lookahead — admin is a credential, so it
 * can't reuse the composer's session-guarded entity search.
 */
export async function searchMcEntities(query: string): Promise<EntitySearchResult[]> {
  const authorised = await checkAdmin();
  if (!authorised.ok) return [];
  return searchEntitiesByName(query, [EntityKind.MC]);
}
