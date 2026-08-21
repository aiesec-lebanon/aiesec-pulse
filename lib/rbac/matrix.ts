import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import { PERMISSION_KEYS, type PermissionKey, ROLE_KEYS, type RoleKey } from "@/lib/rbac/catalogue";
import { cached, cacheDelete, cacheKeys } from "@/lib/redis";

// What a position class may do is the one thing administrators configure
// (architecture.md, "Configurable capability matrix"): the live answer is the
// `RolePermission` table, and `catalogue.ts` holds only the defaults the seed
// writes there. Reading it here rather than in `can.ts` keeps it one shared
// cache entry — a matrix edit busts a single key and reaches every user at
// once, which a per-user cache could never do without enumerating them.

export type PermissionMatrix = Record<RoleKey, PermissionKey[]>;

const TTL_SECONDS = 60;

function isRoleKey(key: string): key is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(key);
}

function isPermissionKey(key: string): key is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(key);
}

/** Every class starts with nothing, so a missing `Role` row grants nothing. */
function emptyMatrix(): PermissionMatrix {
  const matrix = {} as PermissionMatrix;
  for (const role of ROLE_KEYS) matrix[role] = [];
  return matrix;
}

// Memoised per request as well as cached across them: the matrix is one row
// set shared by every viewer, and a request that runs several permission
// checks should not pay for it more than once.
export const permissionMatrix = cache(async (): Promise<PermissionMatrix> => {
  return cached<PermissionMatrix>(cacheKeys.permissionMatrix(), TTL_SECONDS, async () => {
    const roles = await db.role.findMany({
      select: {
        key: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });

    const matrix = emptyMatrix();
    for (const role of roles) {
      // Keys are closed lists on both axes. A row naming something outside
      // them is a leftover, not a permission — it grants nothing.
      if (!isRoleKey(role.key)) continue;
      matrix[role.key] = role.permissions.map((rp) => rp.permission.key).filter(isPermissionKey);
    }
    return matrix;
  });
});

export async function invalidatePermissionMatrix(): Promise<void> {
  await cacheDelete(cacheKeys.permissionMatrix());
}
