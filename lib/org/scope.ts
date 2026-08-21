import "server-only";

import { ScopeType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { ancestorChain } from "@/lib/org/entities";
import { can } from "@/lib/rbac/can";
import { NARROWEST_PUBLISHING_TIER, PUBLISHING_TIERS, type RoleKey } from "@/lib/rbac/catalogue";
import { cached, cacheKeys } from "@/lib/redis";

// A relevance filter, not a confidentiality boundary — the content policy says
// as much to members.

export type ScopeSet = {
  entityIds: string[];
  primaryEntityId: string | null;
  primaryEntityPath: string | null;
  regionEntityId: string | null;
};

const TTL_SECONDS = 5 * 60;

export async function scopeSetFor(user: {
  id: string;
  primaryEntityId: string | null;
}): Promise<ScopeSet> {
  return cached<ScopeSet>(cacheKeys.scopeSet(user.id), TTL_SECONDS, async () => {
    if (!user.primaryEntityId) {
      return {
        entityIds: [],
        primaryEntityId: null,
        primaryEntityPath: null,
        regionEntityId: null,
      };
    }

    const chain = await ancestorChain(user.primaryEntityId);
    const primary = chain.find((e) => e.id === user.primaryEntityId) ?? null;
    const region = chain.find((e) => e.kind === "REGION") ?? null;

    return {
      entityIds: chain.map((e) => e.id),
      primaryEntityId: primary?.id ?? null,
      primaryEntityPath: primary?.path ?? null,
      regionEntityId: region?.id ?? null,
    };
  });
}

// Filtering in the query, not in application code, so a missing guard cannot
// leak rows through a list endpoint.
export function audienceFilter(scope: ScopeSet) {
  return {
    audiences: {
      some: {
        OR: [
          { scopeType: ScopeType.GLOBAL },
          ...(scope.entityIds.length > 0 ? [{ entityId: { in: scope.entityIds } }] : []),
        ],
      },
    },
  };
}

export function defaultAudience(): Array<{ scopeType: ScopeType; entityId: string | null }> {
  return [{ scopeType: ScopeType.GLOBAL, entityId: null }];
}

// Shared by every page that needs to show a publisher their effective quota
// tier before they submit (most permissive grant wins) — currently
// /posts/new and /posts/[slug]/edit. Server Actions resolve their own,
// entity-scoped version of this at write time; this is the display-only read.
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
 * What a publisher may choose as their post's audience. `fixed` means there
 * is no real choice to offer — context.md §7.2's "target audience beyond own
 * scope: ❌" for every MC and LC class — so the composer shows
 * their entity as information, not a control. `open` (post.target_beyond)
 * gets the full picker: GLOBAL, any region, or any entity via typeahead.
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
 * The RBAC boundary itself, isolated from any DB lookup so it's unit-testable
 * under a fake clock-free, DB-free harness: given what a publisher is allowed
 * to target and what they submitted, decide accept/reject. A `fixed` result
 * only ever accepts an absent submission or one that already names their own
 * entity — anything else (a REGION/GLOBAL audience from a client that skipped
 * or tampered with the picker) is rejected outright, not silently narrowed to
 * their entity, so a bypassed client fails loudly rather than appearing to
 * succeed while quietly doing something different from what it asked for.
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
 * The DB-touching wrapper `createPost`/`publishDraft` actually call: runs the
 * pure decision above, then — only for a REGION/ENTITY result — confirms the
 * named entity is real, active, and (for REGION) actually a region. The scope
 * boundary is never trusted from the client, only re-derived server-side.
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
