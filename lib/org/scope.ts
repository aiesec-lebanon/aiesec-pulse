import "server-only";

import { ScopeType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { ancestorChain } from "@/lib/org/entities";
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
export async function publishingRoleKeyFor(userId: string): Promise<string> {
  const grants = await db.roleGrant.findMany({
    where: {
      userId,
      revokedAt: null,
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    select: { role: { select: { key: true } } },
  });
  for (const key of ["platform_admin", "global_publisher", "entity_editor", "entity_publisher"]) {
    if (grants.some((g) => g.role.key === key)) return key;
  }
  return "entity_publisher";
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
