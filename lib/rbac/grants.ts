import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { GrantSource, ScopeType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";

// RoleGrant is uniquely keyed on [userId, roleId, scopeType, scopeEntityId,
// termLabel], and the last two are nullable. Postgres treats NULLs as distinct
// inside a unique index, so an upsert keyed on it would insert a duplicate
// grant on every login. Use the constraint when both are present, find-then-
// write when either is NULL.

export type GrantSpec = {
  userId: string;
  roleId: string;
  scopeType: ScopeType;
  scopeEntityId: string | null;
  termLabel: string | null;
  source?: GrantSource;
  gisPositionId?: string | null;
  endsAt?: Date | null;
  grantedById?: string | null;
};

export type GrantOutcome = { id: string; created: boolean };

export async function upsertRoleGrant(
  spec: GrantSpec,
  client: Prisma.TransactionClient | typeof db = db
): Promise<GrantOutcome> {
  const update = {
    revokedAt: null,
    endsAt: spec.endsAt ?? null,
    ...(spec.gisPositionId !== undefined ? { gisPositionId: spec.gisPositionId } : {}),
    ...(spec.grantedById !== undefined ? { grantedById: spec.grantedById } : {}),
  };

  const create = {
    userId: spec.userId,
    roleId: spec.roleId,
    scopeType: spec.scopeType,
    scopeEntityId: spec.scopeEntityId,
    termLabel: spec.termLabel,
    source: spec.source ?? GrantSource.GIS,
    gisPositionId: spec.gisPositionId ?? null,
    endsAt: spec.endsAt ?? null,
    grantedById: spec.grantedById ?? null,
  };

  if (spec.scopeEntityId !== null && spec.termLabel !== null) {
    const row = await client.roleGrant.upsert({
      where: {
        userId_roleId_scopeType_scopeEntityId_termLabel: {
          userId: spec.userId,
          roleId: spec.roleId,
          scopeType: spec.scopeType,
          scopeEntityId: spec.scopeEntityId,
          termLabel: spec.termLabel,
        },
      },
      update,
      create,
      select: { id: true, createdAt: true },
    });
    return { id: row.id, created: row.createdAt.getTime() > Date.now() - 2000 };
  }

  const existing = await client.roleGrant.findFirst({
    where: {
      userId: spec.userId,
      roleId: spec.roleId,
      scopeType: spec.scopeType,
      scopeEntityId: spec.scopeEntityId,
      termLabel: spec.termLabel,
    },
    select: { id: true },
  });

  if (existing) {
    await client.roleGrant.update({ where: { id: existing.id }, data: update });
    return { id: existing.id, created: false };
  }

  const row = await client.roleGrant.create({ data: create, select: { id: true } });
  return { id: row.id, created: true };
}
