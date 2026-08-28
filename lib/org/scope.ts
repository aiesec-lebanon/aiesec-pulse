import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { EntityKind, PostLevel, ScopeType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { ancestorChain, subtreeEntityIds } from "@/lib/org/entities";
import { can } from "@/lib/rbac/can";
import { NARROWEST_PUBLISHING_TIER, PUBLISHING_TIERS, type RoleKey } from "@/lib/rbac/catalogue";
import { cached, cacheKeys } from "@/lib/redis";

// A relevance filter, not a confidentiality boundary — the content policy says
// as much to members.

export type ScopeSet = {
  /** LOCAL posts visible to this viewer: MC subtree + region. Empty when `unrestricted`. */
  entityIds: string[];
  /** The viewer sits at the global root, so every entity is already beneath them. */
  unrestricted: boolean;
  primaryEntityId: string | null;
  primaryEntityPath: string | null;
  regionEntityId: string | null;
};

const TTL_SECONDS = 5 * 60;

const NO_SCOPE: ScopeSet = {
  entityIds: [],
  unrestricted: false,
  primaryEntityId: null,
  primaryEntityPath: null,
  regionEntityId: null,
};

type EntityRef = { id: string; kind: EntityKind; path: string };

/**
 * Local reach roots at the viewer's MC, not their ancestor chain — the
 * chain missed sibling LCs under the same MC. Above MC tier, roots at the
 * viewer's own entity instead (the whole tree, at the global root).
 */
export function localRootOf(
  chain: readonly EntityRef[],
  primaryEntityId: string
): EntityRef | null {
  const primary = chain.find((e) => e.id === primaryEntityId) ?? null;
  return chain.find((e) => e.kind === EntityKind.MC) ?? primary;
}

export async function scopeSetFor(user: {
  id: string;
  primaryEntityId: string | null;
}): Promise<ScopeSet> {
  return cached<ScopeSet>(cacheKeys.scopeSet(user.id), TTL_SECONDS, async () => {
    if (!user.primaryEntityId) return NO_SCOPE;

    const chain = await ancestorChain(user.primaryEntityId);
    const primary = chain.find((e) => e.id === user.primaryEntityId) ?? null;
    const region = chain.find((e) => e.kind === EntityKind.REGION) ?? null;
    const localRoot = localRootOf(chain, user.primaryEntityId);
    if (!primary || !localRoot) return NO_SCOPE;

    const anchors = {
      primaryEntityId: primary.id,
      primaryEntityPath: primary.path,
      regionEntityId: region?.id ?? null,
    };

    if (localRoot.kind === EntityKind.GLOBAL) {
      return { entityIds: [], unrestricted: true, ...anchors };
    }

    const subtree = await subtreeEntityIds(localRoot.id);
    return {
      entityIds: region ? [...subtree, region.id] : subtree,
      unrestricted: false,
      ...anchors,
    };
  });
}

/**
 * Visible = NETWORK OR audience within viewer's scope, filtered in the
 * query so no code path can leak rows. Returns a top-level `OR` — a
 * caller with its own `OR` must nest both under `AND`.
 */
export function visibilityFilter(scope: ScopeSet): Prisma.PostWhereInput {
  if (scope.unrestricted) return {};

  return {
    OR: [
      { level: PostLevel.NETWORK },
      {
        audiences: {
          some: {
            OR: [
              { scopeType: ScopeType.GLOBAL },
              ...(scope.entityIds.length > 0 ? [{ entityId: { in: scope.entityIds } }] : []),
            ],
          },
        },
      },
    ],
  };
}

export function defaultAudience(): Array<{ scopeType: ScopeType; entityId: string | null }> {
  return [{ scopeType: ScopeType.GLOBAL, entityId: null }];
}

// Display-only preview of a publisher's quota tier (most permissive grant
// wins). Server Actions resolve their own entity-scoped version at write
// time — this isn't what's actually enforced.
export async function publishingRoleKeyFor(userId: string): Promise<RoleKey> {
  const grants = await db.roleGrant.findMany({
    where: {
      userId,
      revokedAt: null,
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    select: { role: { select: { key: true } } },
  });
  for (const key of PUBLISHING_TIERS) {
    if (grants.some((g) => g.role.key === key)) return key;
  }
  return NARROWEST_PUBLISHING_TIER;
}

export async function resolveAudienceSize(
  audiences: Array<{ scopeType: ScopeType; entityId: string | null }>
): Promise<number> {
  if (audiences.some((a) => a.scopeType === ScopeType.GLOBAL)) {
    return db.user.count({ where: { status: "ACTIVE" } });
  }

  const entityIds = audiences.map((a) => a.entityId).filter((id): id is string => Boolean(id));
  if (entityIds.length === 0) return 0;

  const scopes = await db.entity.findMany({
    where: { id: { in: entityIds } },
    select: { path: true },
  });
  if (scopes.length === 0) return 0;

  return db.user.count({
    where: {
      status: "ACTIVE",
      primaryEntity: {
        OR: scopes.flatMap((s) => [{ path: s.path }, { path: { startsWith: `${s.path}/` } }]),
      },
    },
  });
}

/**
 * `fixed`: no real choice — MC/LC can't target beyond their own scope, so
 * the composer shows it as information, not a control. `open`
 * (post.target_beyond): full picker — GLOBAL, any region, any entity.
 */
export type AudienceOptions =
  | { kind: "fixed"; entityId: string; label: string }
  | { kind: "open"; regions: Array<{ id: string; name: string }> };

export async function availableAudiencesFor(
  user: { id: string },
  entityId: string
): Promise<AudienceOptions> {
  if (await can(user, "post.target_beyond")) {
    const regions = await db.entity.findMany({
      where: { kind: "REGION", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return { kind: "open", regions };
  }

  const entity = await db.entity.findUnique({ where: { id: entityId }, select: { name: true } });
  return { kind: "fixed", entityId, label: entity?.name ?? "your entity" };
}

export type SubmittedAudience = { scopeType: ScopeType; entityId: string | null };
export type AudienceDecision =
  | { ok: true; scopeType: ScopeType; entityId: string | null }
  | { ok: false; error: string };

/**
 * Pure RBAC decision, DB-free for unit testing. `fixed` only accepts an
 * absent submission or one naming the publisher's own entity — anything
 * else (a tampered client) is rejected outright, never silently narrowed.
 */
export function decideAudienceForSubmission(
  options: AudienceOptions,
  submitted: SubmittedAudience | undefined
): AudienceDecision {
  if (options.kind === "fixed") {
    if (
      !submitted ||
      (submitted.scopeType === ScopeType.ENTITY && submitted.entityId === options.entityId)
    ) {
      return { ok: true, scopeType: ScopeType.ENTITY, entityId: options.entityId };
    }
    return { ok: false, error: "You can only publish to your own entity." };
  }

  if (!submitted || submitted.scopeType === ScopeType.GLOBAL) {
    return { ok: true, scopeType: ScopeType.GLOBAL, entityId: null };
  }
  if (!submitted.entityId) {
    return { ok: false, error: "Choose an entity for this audience." };
  }
  return { ok: true, scopeType: submitted.scopeType, entityId: submitted.entityId };
}

/**
 * DB-touching wrapper used by createPost/publishDraft: runs the pure
 * decision above, then verifies a REGION/ENTITY result is real, active,
 * and the right kind. Never trusts the client's scope boundary.
 */
export async function resolveSubmittedAudience(
  options: AudienceOptions,
  submitted: SubmittedAudience | undefined
): Promise<
  | { ok: true; audiences: Array<{ scopeType: ScopeType; entityId: string | null }> }
  | { ok: false; error: string }
> {
  const decision = decideAudienceForSubmission(options, submitted);
  if (!decision.ok) return decision;

  if (decision.entityId) {
    const entity = await db.entity.findUnique({
      where: { id: decision.entityId },
      select: { kind: true, isActive: true },
    });
    if (!entity || !entity.isActive) {
      return { ok: false, error: "That entity could not be found." };
    }
    if (decision.scopeType === ScopeType.REGION && entity.kind !== "REGION") {
      return { ok: false, error: "Choose a region for a region-wide audience." };
    }
  }

  return { ok: true, audiences: [{ scopeType: decision.scopeType, entityId: decision.entityId }] };
}
