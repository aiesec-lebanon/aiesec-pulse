import "server-only";

import type { User } from "@/app/generated/prisma/client";
import { GrantSource, ScopeType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { resolveOfficeEntity, ROOT_ENTITY_ID } from "@/lib/org/entities";
import { depthOf } from "@/lib/org/path";
import { upsertRoleGrant } from "@/lib/rbac/grants";
import {
  choosePrimaryPosition,
  derivePublishingGrants,
  type PositionInput,
} from "@/lib/rbac/position-mapping";
import { invalidateUserAuthorisation } from "@/lib/redis";
import { currentTermLabel } from "@/lib/term";
import type { GisPerson } from "@/server-utils/gis";
import { warnIfPositionless } from "@/server-utils/gis";

// Reconciliation is additive and expiring, never destructive: a grant that
// disappears from GIS gets an `endsAt` rather than a DELETE, so past posts
// keep their attribution through a handover.

export type SyncResult = {
  user: User;
  grantsAdded: number;
  grantsExpired: number;
  unmatchedTitles: string[];
};

async function toPositionInputs(person: GisPerson): Promise<PositionInput[]> {
  const inputs: PositionInput[] = [];

  for (const position of person.current_positions) {
    if (!position.office?.id) continue;

    // Unknown offices become placeholders rather than failing the login.
    const entity = await resolveOfficeEntity(position.office);

    inputs.push({
      positionId: position.id ?? null,
      roleName: position.role?.name ?? null,
      officeId: position.office.id,
      officeName: position.office.name,
      officeTag: position.office.tag ?? null,
      officeDepth: depthOf(entity.path),
    });
  }

  return inputs;
}

async function roleIdByKey(key: string): Promise<string | null> {
  const role = await db.role.findUnique({ where: { key }, select: { id: true } });
  return role?.id ?? null;
}

/** Manually granted roles are never touched here — see MANUAL_ONLY_ROLES. */
export async function syncIdentityFromGis(person: GisPerson): Promise<SyncResult> {
  warnIfPositionless(person);

  const positions = await toPositionInputs(person);
  const primary = choosePrimaryPosition(positions);

  const primaryEntityId = primary?.officeId
    ? ((
        await db.entity.findUnique({
          where: { gisOfficeId: primary.officeId },
          select: { id: true },
        })
      )?.id ?? ROOT_ENTITY_ID)
    : ROOT_ENTITY_ID;

  const now = new Date();
  const profile = {
    fullName: person.full_name,
    email: person.email ?? null,
    avatarUrl: person.profile_photo ?? null,
    primaryEntityId,
    lastSyncedAt: now,
    lastSeenAt: now,
  };

  const user = await db.user.upsert({
    where: { aiesecPersonId: person.id },
    update: profile,
    create: { aiesecPersonId: person.id, ...profile },
  });

  if (user.status === "ERASED") {
    logger.warn("Sign-in attempted for an erased account", { userId: user.id });
    return { user, grantsAdded: 0, grantsExpired: 0, unmatchedTitles: [] };
  }

  const { grants: derived, unmatched } = derivePublishingGrants(positions);
  if (unmatched.length > 0) {
    // Logged so the vocabulary can be extended from real titles. A silent miss
    // looks like a bug.
    logger.info("GIS position titles matched no publishing role", {
      userId: user.id,
      titles: unmatched.map((u) => u.roleName),
    });
  }

  const termLabel = currentTermLabel(now);
  let grantsAdded = 0;

  // Not term-bounded: being a member is not a position, and expiring it
  // annually would sign the network out at handover.
  const memberRoleId = await roleIdByKey("member");
  if (memberRoleId) {
    const outcome = await upsertRoleGrant({
      userId: user.id,
      roleId: memberRoleId,
      scopeType: ScopeType.GLOBAL,
      scopeEntityId: null,
      termLabel: null,
      source: GrantSource.GIS,
    });
    if (outcome.created) grantsAdded++;
  }

  const keepIds = new Set<string>();

  for (const grant of derived) {
    const roleId = await roleIdByKey(grant.role);
    if (!roleId) continue;

    const scopeEntityId = grant.officeId
      ? ((
          await db.entity.findUnique({
            where: { gisOfficeId: grant.officeId },
            select: { id: true },
          })
        )?.id ?? null)
      : null;

    const scopeType = scopeEntityId ? ScopeType.ENTITY : ScopeType.GLOBAL;

    const outcome = await upsertRoleGrant({
      userId: user.id,
      roleId,
      scopeType,
      scopeEntityId,
      termLabel,
      gisPositionId: grant.positionId,
      source: GrantSource.GIS,
    });

    keepIds.add(outcome.id);
    if (outcome.created) grantsAdded++;
  }

  // `endsAt`, never DELETE, so historical attribution survives.
  const stale = await db.roleGrant.findMany({
    where: {
      userId: user.id,
      source: GrantSource.GIS,
      termLabel,
      revokedAt: null,
      endsAt: null,
      id: { notIn: keepIds.size > 0 ? [...keepIds] : ["__none__"] },
      role: { key: { notIn: ["member"] } },
    },
    select: { id: true },
  });

  if (stale.length > 0) {
    await db.roleGrant.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { endsAt: now },
    });
  }

  await invalidateUserAuthorisation(user.id);

  return {
    user,
    grantsAdded,
    grantsExpired: stale.length,
    unmatchedTitles: unmatched.map((u) => u.roleName),
  };
}

export const STALENESS_CEILING_MS = 72 * 60 * 60 * 1000;

export function isWithinStalenessCeiling(lastSyncedAt: Date | null): boolean {
  if (!lastSyncedAt) return false;
  return Date.now() - lastSyncedAt.getTime() < STALENESS_CEILING_MS;
}
