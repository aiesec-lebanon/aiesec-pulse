"use server";

import { revalidatePath } from "next/cache";

import { userActor, withAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/rbac/guards";
import { invalidateUserAuthorisation } from "@/lib/redis";

// There is deliberately no `grantRole` here. Authority is whatever GIS says a
// person's current positions are (architecture.md §6.2), so a hand-granted role
// could be conferred by Pulse but never revoked by AIESEC at handover. What
// remains are the two containment levers an admin still needs when a grant is
// wrong: end it early, and end the sessions holding it. Both are audited, and
// both are undone by the next sign-in if GIS still says the position is real.

export type GrantResult = { ok: true } | { ok: false; error: string };

/** Sets `revokedAt` rather than deleting, so grant history stays queryable. */
export async function revokeRoleGrant(grantId: string, reason: string): Promise<GrantResult> {
  const authorised = await checkPermission("admin.configure_roles");
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
  const authorised = await checkPermission("admin.configure_roles");
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
