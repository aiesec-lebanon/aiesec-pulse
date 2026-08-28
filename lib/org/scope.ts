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
  /**
   * The entities a LOCAL post may be aimed at for this viewer to see it: the
   * viewer's MC subtree, plus their region. Empty when `unrestricted`.
   */
  entityIds: string[];
  /**
   * The viewer sits at the global root, so every entity is already beneath
   * them — nothing for the local arm to exclude. Materialising every entity
   * id would give the same answer at far greater cost.
   */
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
 * Where a viewer's local reach starts, isolated from the database so the rule
 * is unit-testable against a hand-built chain.
 *
 * The local root is the viewer's **MC**, not their ancestor chain — the chain
 * never contained sibling LCs, so an LC member couldn't see the LC next door
 * under the same MC. Above the MC tier there's no MC to anchor to, so it
 * roots at the viewer's own entity instead — at the global root, that's the
 * whole tree.
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

    // The subtree is bounded by one MC's LC count rather than by the network,
    // which is what makes materialising it as a list affordable at all.
    const subtree = await subtreeEntityIds(localRoot.id);
    return {
      entityIds: region ? [...subtree, region.id] : subtree,
      unrestricted: false,
      ...anchors,
    };
  });
}

/**
 * A post is visible on two independent grounds and what
 * a viewer sees is the **union** of them: the post is NETWORK, whoever
 * published it, or it is aimed at somewhere in the viewer's local scope.
 *
 * `PostAudience` narrows *within* a level — it is how a publisher aims a LOCAL
 * post inside their own MC — so audience targeting and promotion cannot be
 * played off against each other to smuggle a post network-wide. The one
 * exception is a GLOBAL audience row, matched regardless of level; only
 * `post.target_beyond` can write one, and no MC or LC class holds
 * it, so it stays an AI-level announcement rather than a route around the quota.
 *
 * Filtering in the query, not in application code, so a missing guard cannot
 * leak rows through a list endpoint. Returns a top-level `OR`: a caller that
 * has an `OR` of its own must nest both under `AND` rather than spreading this.
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

// Shared by every page needing to show a publisher their effective quota tier
// before submitting (most permissive grant wins) — currently /posts/new and
// /posts/[slug]/edit. Server Actions resolve their own entity-scoped version
// at write time; this is the display-only read.
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
 * What a publisher may choose as their post's audience. `fixed` means there's
 * no real choice — no MC or LC class may target beyond its own scope — so the
 * composer shows their entity as information, not a control. `open`
 * (post.target_beyond) gets the full picker: GLOBAL, any region, or any
 * entity via typeahead.
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
