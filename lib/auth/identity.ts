import "server-only";

import type { User } from "@/app/generated/prisma/client";
import { GrantSource, ScopeType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { resolveOfficeEntity, ROOT_ENTITY_ID } from "@/lib/org/entities";
import { upsertRoleGrant } from "@/lib/rbac/grants";
import {
  choosePrimaryOfficeId,
  derivePositionGrants,
  type PositionDenial,
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
  /**
   * `null` only when nothing resolved *and* no account exists yet: a person who
   * cannot sign in should not leave a row behind for having tried. An existing
   * account is always reconciled, even down to zero grants, because losing every
   * position is exactly the case where the old ones must stop working.
   */
  user: User | null;
  /** Zero means sign-in is refused. Nothing else in the result changes that. */
  recognisedPositions: number;
  grantsAdded: number;
  grantsExpired: number;
  denied: PositionDenial[];
};

async function toPositionInputs(person: GisPerson): Promise<PositionInput[]> {
  const inputs: PositionInput[] = [];

  for (const position of person.current_positions) {
    if (!position.office?.id) continue;

    // Unknown offices become placeholders rather than failing the login. The
    // entity is resolved here and not used for the level check — level comes
    // from `office.tag`, never from where the tree happens to have parked a
    // placeholder.
    await resolveOfficeEntity(position.office);

    inputs.push({
      positionId: position.id ?? null,
      roleName: position.role?.name ?? null,
      officeId: position.office.id,
      officeName: position.office.name,
      officeTag: position.office.tag ?? null,
    });
  }

  return inputs;
}

async function roleIdByKey(key: string): Promise<string | null> {
  const role = await db.role.findUnique({ where: { key }, select: { id: true } });
  return role?.id ?? null;
}

/**
 * A denied position means either a title we do not recognise — ordinary, and
 * the reason the vocabulary is extended from real data by a maintainer — or the
 * two axes disagreeing, which means our model of GIS is wrong and is worth
 * waking someone for. Both carry title, office and tag so the record is
 * actionable without a second query.
 */
function logDenials(userId: string, denied: readonly PositionDenial[]): void {
  for (const denial of denied) {
    const detail = {
      userId,
      positionId: denial.positionId,
      roleName: denial.roleName,
      officeId: denial.officeId,
      officeName: denial.officeName,
      officeTag: denial.officeTag,
      reason: denial.reason,
      expectedTag: denial.expectedTag,
    };

    if (denial.reason === "tag_mismatch" || denial.reason === "unknown_office_tag") {
      logger.error("GIS position denied: office tag and position title disagree", {
        ...detail,
        severity: "HIGH",
        action: "Confirm the office's tag in GIS, or correct the class table in position-mapping.",
      });
    } else {
      logger.warn("GIS position denied", detail);
    }
  }
}

/**
 * There is no implicit `member` grant. Membership is a position like any other
 * and has to come back from GIS as one; granting it to whoever completed the
 * OAuth handshake would mean a renamed or expired position quietly downgrading
 * someone to a working account instead of failing loudly (architecture.md §7.1).
 */
export async function syncIdentityFromGis(person: GisPerson): Promise<SyncResult> {
  warnIfPositionless(person);

  const positions = await toPositionInputs(person);
  const { grants: derived, denied } = derivePositionGrants(positions);

  const existing = await db.user.findUnique({ where: { aiesecPersonId: person.id } });

  if (derived.length === 0 && !existing) {
    logger.warn("Sign-in refused: no GIS position resolved to a Pulse role", {
      aiesecPersonId: person.id,
      positionCount: positions.length,
      denied: denied.map((d) => ({
        roleName: d.roleName,
        officeName: d.officeName,
        officeTag: d.officeTag,
        reason: d.reason,
      })),
    });
    return { user: null, recognisedPositions: 0, grantsAdded: 0, grantsExpired: 0, denied };
  }

  const primaryOfficeId = choosePrimaryOfficeId(derived);
  const primaryEntityId = primaryOfficeId
    ? ((
        await db.entity.findUnique({
          where: { gisOfficeId: primaryOfficeId },
          select: { id: true },
        })
      )?.id ?? ROOT_ENTITY_ID)
    : // Nothing resolved, so there is nothing to move them to. Keeping the last
      // known entity beats relocating an offboarded member to the global root.
      (existing?.primaryEntityId ?? ROOT_ENTITY_ID);

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
    return {
      user,
      recognisedPositions: derived.length,
      grantsAdded: 0,
      grantsExpired: 0,
      denied,
    };
  }

  logDenials(user.id, denied);

  const termLabel = currentTermLabel(now);
  let grantsAdded = 0;
  const keepIds = new Set<string>();

  for (const grant of derived) {
    const roleId = await roleIdByKey(grant.role);
    if (!roleId) continue;

    const scopeEntityId = grant.scopeOfficeId
      ? ((
          await db.entity.findUnique({
            where: { gisOfficeId: grant.scopeOfficeId },
            select: { id: true },
          })
        )?.id ?? null)
      : null;

    const scopeType = scopeEntityId ? ScopeType.ENTITY : ScopeType.GLOBAL;

    // `member` is not term-bounded: it is the one class that survives a
    // handover, and expiring it annually would sign the network out.
    const isMember = grant.role === "member";

    const outcome = await upsertRoleGrant({
      userId: user.id,
      roleId,
      scopeType,
      scopeEntityId,
      termLabel: isMember ? null : termLabel,
      gisPositionId: isMember ? null : grant.positionId,
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

  if (derived.length === 0) {
    logger.warn("Every position for an existing account was denied; grants expired", {
      userId: user.id,
      grantsExpired: stale.length,
    });
  }

  return {
    user,
    recognisedPositions: derived.length,
    grantsAdded,
    grantsExpired: stale.length,
    denied,
  };
}

export const STALENESS_CEILING_MS = 72 * 60 * 60 * 1000;

export function isWithinStalenessCeiling(lastSyncedAt: Date | null): boolean {
  if (!lastSyncedAt) return false;
  return Date.now() - lastSyncedAt.getTime() < STALENESS_CEILING_MS;
}
