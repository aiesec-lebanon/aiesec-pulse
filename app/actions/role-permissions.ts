"use server";

import { revalidatePath } from "next/cache";

import { adminActor, withAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { PERMISSION_KEYS, type PermissionKey, ROLE_KEYS, type RoleKey } from "@/lib/rbac/catalogue";
import { checkAdmin } from "@/lib/rbac/guards";
import { invalidatePermissionMatrix } from "@/lib/rbac/matrix";

// The one thing an administrator configures: what a position class may do.
// Who holds which class, and where, is never editable here — that comes from
// GIS at every sign-in.

export type MatrixResult = { ok: true } | { ok: false; error: string };

function isRoleKey(key: string): key is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(key);
}

function isPermissionKey(key: string): key is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(key);
}

export async function setRolePermission(
  roleKey: string,
  permissionKey: string,
  allowed: boolean
): Promise<MatrixResult> {
  const authorised = await checkAdmin();
  if (!authorised.ok) return { ok: false, error: authorised.error };

  // Both axes are closed lists — an administrator composes from the catalogue
  // and never invents a key.
  if (!isRoleKey(roleKey)) return { ok: false, error: "Unknown position class." };
  if (!isPermissionKey(permissionKey)) return { ok: false, error: "Unknown permission." };

  const [role, permission] = await Promise.all([
    db.role.findUnique({ where: { key: roleKey }, select: { id: true } }),
    db.permission.findUnique({ where: { key: permissionKey }, select: { id: true } }),
  ]);
  if (!role || !permission) {
    return { ok: false, error: "That row is not in the catalogue yet — reseed and try again." };
  }

  return withAudit(
    adminActor(authorised.admin),
    allowed ? "role.permission_granted" : "role.permission_revoked",
    { type: "role", id: roleKey },
    { permission: permissionKey },
    async () => {
      if (allowed) {
        await db.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      } else {
        await db.rolePermission.deleteMany({
          where: { roleId: role.id, permissionId: permission.id },
        });
      }

      await invalidatePermissionMatrix();
      revalidatePath("/admin/roles");
      return { ok: true as const };
    }
  );
}
