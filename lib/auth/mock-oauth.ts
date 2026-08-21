import "server-only";

import { GrantSource, ScopeType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { isProductionDeployment } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ROOT_ENTITY_ID } from "@/lib/org/entities";
import type { RoleKey } from "@/lib/rbac/catalogue";
import { upsertRoleGrant } from "@/lib/rbac/grants";
import { invalidateUserAuthorisation } from "@/lib/redis";
import { currentTermLabel } from "@/lib/term";

// Requires both PULSE_E2E_MOCK_AUTH=1 and a non-production deployment.
// NODE_ENV is deliberately not one of them: `next start` sets it to
// "production" for every built app, including the one under test.

export function mockAuthEnabled(): boolean {
  if (process.env.PULSE_E2E_MOCK_AUTH !== "1") return false;

  if (isProductionDeployment()) {
    logger.error("Mock authentication was requested on the production deployment and refused", {
      severity: "CRITICAL",
      action: "Remove PULSE_E2E_MOCK_AUTH from the production environment immediately.",
    });
    return false;
  }

  return true;
}

export type MockPersona = "member" | "publisher" | "editor" | "moderator" | "admin";

// Persona names are the e2e suite's vocabulary, not the catalogue's; each maps
// onto the position class that carries the capability the persona exists to
// exercise. Replaced wholesale when the suite starts intercepting GIS.
const PERSONAS: Record<MockPersona, { name: string; roles: RoleKey[] }> = {
  member: { name: "Test Member", roles: ["member"] },
  publisher: { name: "Test Publisher", roles: ["member", "lc_vp"] },
  editor: { name: "Test Editor", roles: ["member", "mc_vp"] },
  moderator: { name: "Test Moderator", roles: ["member", "mc_president"] },
  admin: { name: "Test Admin", roles: ["member", "pai"] },
};

// `isolate` gives the persona its own account. Quota is per author per week,
// so specs that publish must not share one.
export async function ensureMockUser(persona: MockPersona, isolate?: string) {
  const spec = PERSONAS[persona];
  const aiesecPersonId = isolate ? `e2e-${persona}-${isolate}` : `e2e-${persona}`;

  const user = await db.user.upsert({
    where: { aiesecPersonId },
    update: { fullName: spec.name, lastSyncedAt: new Date(), lastSeenAt: new Date() },
    create: {
      aiesecPersonId,
      fullName: spec.name,
      email: `${aiesecPersonId}@e2e.invalid`,
      primaryEntityId: ROOT_ENTITY_ID,
      lastSyncedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  const termLabel = currentTermLabel();

  for (const roleKey of spec.roles) {
    const role = await db.role.findUnique({ where: { key: roleKey }, select: { id: true } });
    if (!role) continue;

    const scopeType =
      roleKey === "member" || roleKey === "pai" ? ScopeType.GLOBAL : ScopeType.ENTITY;
    const scopeEntityId = scopeType === ScopeType.ENTITY ? ROOT_ENTITY_ID : null;

    await upsertRoleGrant({
      userId: user.id,
      roleId: role.id,
      scopeType,
      scopeEntityId,
      termLabel,
      source: GrantSource.MANUAL,
    });
  }

  await invalidateUserAuthorisation(user.id);
  return user;
}

export const MOCK_PERSONAS = Object.keys(PERSONAS) as MockPersona[];
