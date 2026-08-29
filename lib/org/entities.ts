import "server-only";

import type { Entity } from "@/app/generated/prisma/client";
import { EntityKind } from "@/app/generated/prisma/enums";
import { cacheDelete, cacheKeys } from "@/lib/cache";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { entityDisplayName } from "@/lib/org/display";
import { depthOf, joinPath, pathSegment } from "@/lib/org/path";
import type { GisOffice } from "@/server-utils/gis";

export const ROOT_ENTITY_ID = "ent_root_ai";

export function kindForDepth(depth: number): EntityKind {
  switch (depth) {
    case 1:
      return EntityKind.GLOBAL;
    case 2:
      return EntityKind.REGION;
    case 3:
      return EntityKind.MC;
    default:
      return EntityKind.LC;
  }
}

export async function rootEntity(): Promise<Entity> {
  const root = await db.entity.findUnique({ where: { id: ROOT_ENTITY_ID } });
  if (root) return root;

  return db.entity.upsert({
    where: { gisOfficeId: "1" },
    update: {},
    create: {
      id: ROOT_ENTITY_ID,
      gisOfficeId: "1",
      name: "AIESEC International",
      tag: "AI",
      kind: EntityKind.GLOBAL,
      path: "/ai",
    },
  });
}

// Segment-level uniqueness is what makes prefix matching a sound authorisation
// primitive. Colliding siblings are disambiguated by GIS office id.
async function uniqueSegment(
  parentId: string | null,
  office: Pick<GisOffice, "id" | "tag" | "name">
): Promise<string> {
  const base = pathSegment(office.tag || office.name || office.id);

  const siblings = await db.entity.findMany({
    where: { parentId, gisOfficeId: { not: office.id } },
    select: { path: true },
  });
  const taken = new Set(siblings.map((s) => s.path.split("/").pop()));

  return taken.has(base) ? `${base}-${pathSegment(office.id)}` : base;
}

export async function upsertOffice(office: GisOffice, parent: Entity): Promise<Entity> {
  const segment = await uniqueSegment(parent.id, office);
  const path = joinPath(parent.path, segment);
  const kind = kindForDepth(depthOf(path));

  const countryCode =
    office.country && office.country.length === 2 ? office.country.toUpperCase() : null;

  return db.entity.upsert({
    where: { gisOfficeId: office.id },
    update: {
      name: office.name,
      tag: office.tag ?? null,
      parentId: parent.id,
      path,
      kind,
      countryCode,
      isActive: true,
      syncedAt: new Date(),
    },
    create: {
      gisOfficeId: office.id,
      name: office.name,
      tag: office.tag ?? null,
      parentId: parent.id,
      path,
      kind,
      countryCode,
      syncedAt: new Date(),
    },
  });
}

// Login must never fail because an office is new, so an unknown one is
// attached under the root and corrected by the next sync.
export async function resolveOfficeEntity(office: GisOffice): Promise<Entity> {
  const existing = await db.entity.findUnique({ where: { gisOfficeId: office.id } });
  if (existing) {
    if (existing.name !== office.name || existing.tag !== (office.tag ?? null)) {
      return db.entity.update({
        where: { id: existing.id },
        data: { name: office.name, tag: office.tag ?? null, syncedAt: new Date() },
      });
    }
    return existing;
  }

  const parent = office.parent?.id
    ? ((await db.entity.findUnique({ where: { gisOfficeId: office.parent.id } })) ??
      (await rootEntity()))
    : await rootEntity();

  const created = await upsertOffice(office, parent);
  logger.info("Created a placeholder entity for an unseen GIS office", {
    gisOfficeId: office.id,
    name: office.name,
    path: created.path,
    parentPath: parent.path,
    note: "Position in the tree is provisional until the next sync-entities run.",
  });
  return created;
}

// An office can be re-parented, so every descendant path moves with it.
// Cycles are caught by the visited set rather than by recursion depth.
export async function recomputeTree(): Promise<{ updated: number; orphaned: number }> {
  const all = await db.entity.findMany({
    select: {
      id: true,
      gisOfficeId: true,
      parentId: true,
      name: true,
      tag: true,
      path: true,
      kind: true,
    },
  });

  const byParent = new Map<string | null, typeof all>();
  for (const e of all) {
    const list = byParent.get(e.parentId) ?? [];
    list.push(e);
    byParent.set(e.parentId, list);
  }

  const root = await rootEntity();
  const visited = new Set<string>([root.id]);
  const updates: Array<{ id: string; path: string; kind: EntityKind }> = [];

  const queue: Array<{ id: string; path: string }> = [{ id: root.id, path: "/ai" }];
  if (root.path !== "/ai") updates.push({ id: root.id, path: "/ai", kind: EntityKind.GLOBAL });

  while (queue.length > 0) {
    const node = queue.shift()!;
    const children = byParent.get(node.id) ?? [];
    const taken = new Set<string>();

    for (const child of children) {
      if (visited.has(child.id)) {
        logger.error("Cycle detected in the entity tree; skipping", { entityId: child.id });
        continue;
      }
      visited.add(child.id);

      let segment = pathSegment(child.tag || child.name || child.gisOfficeId);
      if (taken.has(segment)) segment = `${segment}-${pathSegment(child.gisOfficeId)}`;
      taken.add(segment);

      const path = joinPath(node.path, segment);
      const kind = kindForDepth(depthOf(path));
      if (child.path !== path || child.kind !== kind) updates.push({ id: child.id, path, kind });
      queue.push({ id: child.id, path });
    }
  }

  for (const u of updates) {
    await db.entity.update({ where: { id: u.id }, data: { path: u.path, kind: u.kind } });
  }

  const orphans = all.filter((e) => !visited.has(e.id));
  if (orphans.length > 0) {
    logger.warn("Entities are not reachable from the global root", {
      count: orphans.length,
      sample: orphans
        .slice(0, 10)
        .map((o) => ({ id: o.id, gisOfficeId: o.gisOfficeId, name: o.name })),
    });
  }

  await cacheDelete(cacheKeys.entityTree());
  return { updated: updates.length, orphaned: orphans.length };
}

export async function subtreeEntityIds(entityId: string): Promise<string[]> {
  const scope = await db.entity.findUnique({ where: { id: entityId }, select: { path: true } });
  if (!scope) return [];

  const rows = await db.entity.findMany({
    where: { OR: [{ id: entityId }, { path: { startsWith: `${scope.path}/` } }] },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export type EntitySearchResult = { id: string; name: string; tag: string | null; path: string };

/**
 * Audience typeahead lookahead. `contains`/`insensitive` compiles to a
 * leading-wildcard ILIKE served by the `Entity_name_trgm_idx` GIN index.
 * 2-char floor stops a single keystroke from scanning the whole table.
 */
export async function searchEntitiesByName(
  query: string,
  kinds: EntityKind[]
): Promise<EntitySearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const rows = await db.entity.findMany({
    where: {
      isActive: true,
      kind: { in: kinds },
      // Matches the stored place name, not the brand lockup — "leb" must
      // find "Lebanon" either way.
      name: { contains: trimmed, mode: "insensitive" },
    },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, tag: true, path: true, kind: true },
  });

  return rows.map((row) => ({
    id: row.id,
    tag: row.tag,
    path: row.path,
    name: entityDisplayName(row.name, row.kind) ?? row.name,
  }));
}

/**
 * Nearest MC on the chain, or self if already an MC. Null above the MC tier
 * is a real answer, not a failure. Resolved by `kind`, not path depth, so
 * it survives the tree gaining or losing a tier.
 */
export async function mcAncestorOf(entityId: string): Promise<Entity | null> {
  const chain = await ancestorChain(entityId);
  return chain.find((e) => e.kind === EntityKind.MC) ?? null;
}

export async function ancestorChain(entityId: string): Promise<Entity[]> {
  const entity = await db.entity.findUnique({ where: { id: entityId } });
  if (!entity) return [];

  const parts = entity.path.split("/").filter(Boolean);
  const paths: string[] = [];
  for (let i = 1; i <= parts.length; i++) paths.push(`/${parts.slice(0, i).join("/")}`);

  const rows = await db.entity.findMany({ where: { path: { in: paths } } });
  return rows.sort((a, b) => a.path.length - b.path.length);
}
