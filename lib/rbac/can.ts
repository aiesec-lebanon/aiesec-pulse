import "server-only";

import { db } from "@/lib/db";
import { isInSubtree } from "@/lib/org/path";
import {
  LOCKED_FULL_ACCESS_ROLES,
  PERMISSION_KEYS,
  type PermissionKey,
  type RoleKey,
} from "@/lib/rbac/catalogue";
import { cached, cacheKeys } from "@/lib/redis";

// Each active grant expands to an entity subtree by Entity.path prefix match.
// Permissions are deliberately not in the session JWT — a token that carries
// authority cannot be de-authorised — so they are resolved per request and
// cached briefly, busted explicitly on grant change.

export type ScopeRef = { type: "GLOBAL" } | { type: "REGION" | "ENTITY"; entityId: string };

export const GLOBAL_SCOPE: ScopeRef = { type: "GLOBAL" };

type ResolvedPermission = { permission: string; scopePath: string | null };

type ResolvedAuthorisation = {
  permissions: ResolvedPermission[];
  roleKeys: string[];
};

const TTL_SECONDS = 60;

async function resolve(userId: string): Promise<ResolvedAuthorisation> {
  return cached<ResolvedAuthorisation>(cacheKeys.permissions(userId), TTL_SECONDS, async () => {
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
        role: {
          select: {
            key: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
        scope: { select: { path: true } },
      },
    });

    const seen = new Set<string>();
    const permissions: ResolvedPermission[] = [];
    const roleKeys = new Set(grants.map((g) => g.role.key));

    // The anti-lockout floor (architecture.md §7.1). Read off the position
    // class itself, before a single RolePermission row is consulted, so no
    // state of the editable matrix - and no row someone deleted by hand - can
    // leave the platform with nobody able to administer it. Scope is `null`,
    // meaning everywhere.
    if (LOCKED_FULL_ACCESS_ROLES.some((locked) => roleKeys.has(locked))) {
      return {
        permissions: PERMISSION_KEYS.map((permission) => ({ permission, scopePath: null })),
        roleKeys: [...roleKeys],
      };
    }

    for (const grant of grants) {
      // A scoped grant whose entity has gone missing resolves to no coverage
      // rather than to global — fail closed.
      const scopePath = grant.scopeType === "GLOBAL" ? null : (grant.scope?.path ?? undefined);
      if (scopePath === undefined) continue;

      for (const rp of grant.role.permissions) {
        const key = `${rp.permission.key}@${scopePath ?? "*"}`;
        if (seen.has(key)) continue;
        seen.add(key);
        permissions.push({ permission: rp.permission.key, scopePath });
      }
    }

    return { permissions, roleKeys: [...roleKeys] };
  });
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

export async function rolesOf(user: Principal): Promise<Set<string>> {
  const { roleKeys } = await resolve(user.id);
  return new Set(roleKeys);
}

export async function hasRole(user: Principal, role: RoleKey): Promise<boolean> {
  return (await rolesOf(user)).has(role);
}

export async function scopePathsFor(
  user: Principal,
  permission: PermissionKey
): Promise<Array<string | null>> {
  const { permissions } = await resolve(user.id);
  return permissions.filter((p) => p.permission === permission).map((p) => p.scopePath);
}

export async function entityScopeFilter(
  user: Principal,
  permission: PermissionKey
): Promise<
  | { publisherEntity: { path: { startsWith: string } } }
  | Record<string, never>
  | { id: string }
  | undefined
> {
  const paths = await scopePathsFor(user, permission);
  if (paths.length === 0) return { id: "__no_scope__" };
  if (paths.includes(null)) return undefined;
  return { publisherEntity: { path: { startsWith: paths[0]! } } };
}

export function __clearPathCache(): void {
  pathCache.clear();
}
