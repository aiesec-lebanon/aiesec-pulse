import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import { isInSubtree } from "@/lib/org/path";
import { type PermissionKey, ROLE_KEYS, type RoleKey } from "@/lib/rbac/catalogue";
import { permissionMatrix } from "@/lib/rbac/matrix";
import { cached, cacheKeys } from "@/lib/redis";

// Each active grant expands to an entity subtree by Entity.path prefix match.
// Permissions aren't in the session JWT (a token can't be de-authorised) —
// resolved per request, cached briefly, busted on grant change. Grants
// (who/where) are cached per user; the shared matrix (what a class may do)
// isn't, so an admin's edit lands for everyone at once. No position
// resolves to platform admin — that's a separate credential
// (lib/auth/admin-session.ts), never a permission here.

export type ScopeRef = { type: "GLOBAL" } | { type: "REGION" | "ENTITY"; entityId: string };

export const GLOBAL_SCOPE: ScopeRef = { type: "GLOBAL" };

type ResolvedPermission = { permission: PermissionKey; scopePath: string | null };

type ResolvedGrant = { roleKey: RoleKey; scopePath: string | null };

type ResolvedAuthorisation = {
  permissions: ResolvedPermission[];
};

const TTL_SECONDS = 60;

function isRoleKey(key: string): key is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(key);
}

const grantsOf = cache(async (userId: string): Promise<ResolvedGrant[]> => {
  return cached<ResolvedGrant[]>(cacheKeys.roleGrants(userId), TTL_SECONDS, async () => {
    const now = new Date();

    const grants = await db.roleGrant.findMany({
      where: {
        userId,
        revokedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        user: { status: { in: ["ACTIVE", "RESTRICTED"] } },
      },
      select: {
        scopeType: true,
        role: { select: { key: true } },
        scope: { select: { path: true } },
      },
    });

    const resolved: ResolvedGrant[] = [];
    for (const grant of grants) {
      // The position vocabulary is closed. A grant naming a class Pulse no
      // longer recognises confers nothing rather than defaulting to something.
      if (!isRoleKey(grant.role.key)) continue;

      // A scoped grant whose entity has gone missing resolves to no coverage
      // rather than to global — fail closed.
      const scopePath = grant.scopeType === "GLOBAL" ? null : (grant.scope?.path ?? undefined);
      if (scopePath === undefined) continue;

      resolved.push({ roleKey: grant.role.key, scopePath });
    }
    return resolved;
  });
});

async function resolve(userId: string): Promise<ResolvedAuthorisation> {
  const grants = await grantsOf(userId);
  const matrix = await permissionMatrix();
  const seen = new Set<string>();
  const permissions: ResolvedPermission[] = [];

  for (const grant of grants) {
    for (const permission of matrix[grant.roleKey]) {
      const key = `${permission}@${grant.scopePath ?? "*"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      permissions.push({ permission, scopePath: grant.scopePath });
    }
  }

  return { permissions };
}

const pathCache = new Map<string, string | null>();

async function entityPath(entityId: string): Promise<string | null> {
  if (pathCache.has(entityId)) return pathCache.get(entityId)!;
  const entity = await db.entity.findUnique({ where: { id: entityId }, select: { path: true } });
  const path = entity?.path ?? null;
  pathCache.set(entityId, path);
  return path;
}

export type Principal = { id: string };

// A GLOBAL scope argument asks "anywhere at all". Anything that writes must
// pass the concrete entity it is writing to.
export async function can(
  user: Principal,
  permission: PermissionKey,
  scope: ScopeRef = GLOBAL_SCOPE
): Promise<boolean> {
  const { permissions } = await resolve(user.id);
  const matching = permissions.filter((p) => p.permission === permission);
  if (matching.length === 0) return false;

  if (scope.type === "GLOBAL") return true;

  const targetPath = await entityPath(scope.entityId);
  if (!targetPath) return false;

  return matching.some((p) => p.scopePath === null || isInSubtree(p.scopePath, targetPath));
}

export async function permissionsOf(user: Principal): Promise<Set<string>> {
  const { permissions } = await resolve(user.id);
  return new Set(permissions.map((p) => p.permission));
}

export async function scopePathsFor(
  user: Principal,
  permission: PermissionKey
): Promise<Array<string | null>> {
  const { permissions } = await resolve(user.id);
  return permissions.filter((p) => p.permission === permission).map((p) => p.scopePath);
}
