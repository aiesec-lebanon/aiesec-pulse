"use server";

import { revalidatePath } from "next/cache";

import { GrantSource, ScopeType } from "@/app/generated/prisma/enums";
import { userActor, withAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isManualOnly, type RoleKey } from "@/lib/rbac/catalogue";
import { upsertRoleGrant } from "@/lib/rbac/grants";
import { checkPermission } from "@/lib/rbac/guards";
import { invalidateUserAuthorisation } from "@/lib/redis";
import { currentTermLabel, termEndsAt } from "@/lib/term";
import { grantRoleSchema } from "@/lib/zod-schemas";

// Only manually granted roles are settable here: publishing roles come from GIS
// and are reconciled at every login, so a hand-grant would be silently reverted.

export type GrantResult = { ok: true } | { ok: false; error: string };

export async function grantRole(input: {
  userId: string;
  roleKey: string;
  scopeEntityId: string | null;
  reason: string;
}): Promise<GrantResult> {
  const authorised = await checkPermission("admin.grant_role");
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const parsed = grantRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid grant." };
  }
  const { userId, roleKey, scopeEntityId, reason } = parsed.data;

  if (!isManualOnly(roleKey as RoleKey)) {
    return {
      ok: false,
      error:
        "Publishing roles are derived from EXPA positions and reconciled at every sign-in. Granting one here would be reverted by the next role sync.",
    };
  }

  const [role, target] = await Promise.all([
    db.role.findUnique({ where: { key: roleKey }, select: { id: true, key: true } }),
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, status: true },
    }),
  ]);
  if (!role) return { ok: false, error: "Unknown role." };
  if (!target) return { ok: false, error: "Unknown member." };
  if (target.status === "ERASED") return { ok: false, error: "That account has been erased." };

  const globalOnly = roleKey === "platform_admin" || roleKey === "global_moderator";
  if (!globalOnly && !scopeEntityId) {
    return { ok: false, error: "Choose the entity this role applies to." };
  }

  const scopeType = globalOnly ? ScopeType.GLOBAL : ScopeType.ENTITY;
  const effectiveScopeEntityId: string | null = globalOnly ? null : scopeEntityId;
  const termLabel = currentTermLabel();

  return withAudit(
    userActor(authorised.user),
    "role.granted",
    { type: "user", id: userId, entityId: effectiveScopeEntityId },
    { roleKey, scopeEntityId: effectiveScopeEntityId, termLabel, reason },
    async () => {
      await upsertRoleGrant({
        userId,
        roleId: role.id,
        scopeType,
        scopeEntityId: effectiveScopeEntityId,
        termLabel,
        source: GrantSource.MANUAL,
        endsAt: termEndsAt(termLabel),
        grantedById: authorised.user.id,
      });

      await invalidateUserAuthorisation(userId);
      revalidatePath("/admin/roles");
      return { ok: true as const };
    }
  );
}

/** Sets `revokedAt` rather than deleting, so grant history stays queryable. */
export async function revokeRoleGrant(grantId: string, reason: string): Promise<GrantResult> {
  const authorised = await checkPermission("admin.grant_role");
  if (!authorised.ok) return { ok: false, error: authorised.error };

  if (reason.trim().length < 5) {
    return { ok: false, error: "Record why this grant is being revoked." };
  }

  const grant = await db.roleGrant.findUnique({
    where: { id: grantId },
    select: { userId: true, scopeEntityId: true, role: { select: { key: true } } },
  });
  if (!grant) return { ok: false, error: "Grant not found." };

  return withAudit(
    userActor(authorised.user),
    "role.revoked",
    { type: "user", id: grant.userId, entityId: grant.scopeEntityId },
    { roleKey: grant.role.key, reason: reason.trim() },
    async () => {
      await db.roleGrant.update({ where: { id: grantId }, data: { revokedAt: new Date() } });
      await invalidateUserAuthorisation(grant.userId);
      revalidatePath("/admin/roles");
      return { ok: true as const };
    }
  );
}

export async function revokeAllSessionsFor(userId: string, reason: string): Promise<GrantResult> {
  const authorised = await checkPermission("admin.grant_role");
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const { revokeAllSessions } = await import("@/lib/auth/session");
  const target = await db.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  if (!target) return { ok: false, error: "Unknown member." };

  return withAudit(
    userActor(authorised.user),
    "session.revoked_all",
    { type: "user", id: userId },
    { reason: reason.trim() || "Not recorded" },
    async () => {
      const count = await revokeAllSessions(userId);
      await db.oauthToken.deleteMany({ where: { userId } });
      revalidatePath("/admin/roles");
      return { ok: true as const, count };
    }
  ).then(() => ({ ok: true as const }));
}
