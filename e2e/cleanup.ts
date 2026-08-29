import "dotenv/config";

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/app/generated/prisma/client";
import { ActorType } from "@/app/generated/prisma/enums";

import { E2E_ADMIN } from "./admin-credentials";
import { E2E_OFFICE_IDS, E2E_PERSON_ID_PREFIX, INTERIOR_OFFICES } from "./gis-stub/fixtures";

/**
 * Runs against the real database, so leftover rows would pollute the next
 * run's feed/search results. Every suite row is reachable from an
 * `e2e-`-prefixed GIS person id or a stub office — never real data — which
 * purge() below keys off. Called from both globalSetup and globalTeardown,
 * since a killed run skips teardown.
 *
 * Runs as a standalone script (not imported): the generated Prisma client
 * needs `import.meta`, which Playwright's CommonJS loader can't evaluate.
 * Run by hand with `npm run e2e:cleanup -- clean` (see cleanup-runner.ts).
 */

type Db = PrismaClient;

// DIRECT_URL bypasses pgbouncer's transaction pooling, which handles a burst
// of DELETEs badly; nothing here needs the pooler anyway.
function connectionString(): string {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Neither DIRECT_URL nor DATABASE_URL is set — cannot clean up after e2e.");
  }
  return url;
}

/**
 * Keys on PULSE_DEPLOYMENT, the same flag lib/env.ts uses — one definition
 * of "is this production", not a second rule that could drift.
 */
function refuseOnProduction(): void {
  if (process.env.PULSE_DEPLOYMENT === "production") {
    throw new Error(
      "The e2e cleanup was invoked against the production deployment and refused. " +
        "Nothing was deleted."
    );
  }
}

async function withDb<T>(fn: (_db: Db) => Promise<T>): Promise<T> {
  refuseOnProduction();
  const db = new PrismaClient({ adapter: new PrismaPg(connectionString()) });
  try {
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

// The cache is process-local now (lib/cache.ts) — there is no store outside
// the running `next start` process for a separate script to reach, so
// there's nothing to bust here. Entries carry short TTLs (feed 60s, flags
// 15s) and expire on their own; a stale hit for under a minute was already
// an accepted trade-off, not a new one.

export type PurgeSummary = {
  users: number;
  posts: number;
  entities: number;
  auditEvents: number;
};

/**
 * Order follows the schema's Restrict relations (Post.author, PostVersion.
 * editedBy, Report.reporter, Appeal.appellant) — those rows must go before
 * the account. Cascaded relations (comments, reactions, sessions, …) are
 * intentionally not listed here; the schema already handles them.
 */
async function purge(db: Db): Promise<PurgeSummary> {
  const users = await db.user.findMany({
    where: { aiesecPersonId: { startsWith: E2E_PERSON_ID_PREFIX } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  // These are still the suite's, and a post targeted at one is reachable
  // through the entity even if its author has somehow gone already.
  const entities = await db.entity.findMany({
    where: { gisOfficeId: { in: E2E_OFFICE_IDS } },
    select: { id: true, path: true },
  });
  const entityIds = entities.map((entity) => entity.id);

  if (userIds.length === 0 && entityIds.length === 0) {
    return { users: 0, posts: 0, entities: 0, auditEvents: 0 };
  }

  const postFilter = {
    OR: [{ authorId: { in: userIds } }, { publisherEntityId: { in: entityIds } }],
  };
  const postIds = (await db.post.findMany({ where: postFilter, select: { id: true } })).map(
    (post) => post.id
  );

  // AuditEvent has no FK (actorId is a bare string by design, so deleting an
  // actor doesn't erase the record) — the one table nothing cascades into,
  // so it must be purged explicitly. Admin rows match by label; adminActor
  // records no id (lib/audit.ts).
  const auditEvents = await db.auditEvent.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        { entityId: { in: entityIds } },
        { targetType: "post", targetId: { in: postIds } },
        { actorType: ActorType.ADMIN, actorLabel: E2E_ADMIN.email },
      ],
    },
  });

  // Must run before posts: a version written on someone else's post would
  // otherwise block this account's deletion.
  await db.postVersion.deleteMany({ where: { editedById: { in: userIds } } });

  const posts = await db.post.deleteMany({ where: postFilter });

  // Post.cover is optional, so deleting the posts nulled the reference rather
  // than the row; the uploads themselves belong to the suite and go now.
  await db.media.deleteMany({ where: { ownerId: { in: userIds } } });

  // Appeals reference reports, so unwind in that order. Neither is used yet
  // (moderation is out of MVP scope), but both are Restrict relations onto User.
  await db.appeal.deleteMany({ where: { appellantId: { in: userIds } } });
  await db.report.deleteMany({
    where: { OR: [{ reporterId: { in: userIds } }, { assigneeId: { in: userIds } }] },
  });

  const deletedUsers = await db.user.deleteMany({ where: { id: { in: userIds } } });

  // An entity-scoped quota policy holds a Restrict relation onto the entity,
  // so an override left by the quota console would keep its MC alive here.
  await db.quotaPolicy.deleteMany({ where: { entityId: { in: entityIds } } });

  // Deepest first: Entity.parent is a self-relation, and a single deleteMany
  // gives Postgres no ordering guarantee between the rows it removes.
  let deletedEntities = 0;
  for (const entity of [...entities].sort((a, b) => b.path.length - a.path.length)) {
    try {
      await db.entity.delete({ where: { id: entity.id } });
      deletedEntities++;
    } catch (error) {
      // Something outside the suite adopted this entity (e.g. a dev's primary
      // entity) — leave it; the fixed gisOfficeId means next run reuses it.
      console.warn(`[e2e cleanup] Left entity ${entity.path} in place:`, error);
    }
  }

  return {
    users: deletedUsers.count,
    posts: posts.count,
    entities: deletedEntities,
    auditEvents: auditEvents.count,
  };
}

/**
 * With `fullyParallel`, there's no guaranteed "first login" to build the
 * office tree — resolveOfficeEntity would park a missing-parent office
 * directly under root, making tree shape (and scope sets) worker-order
 * dependent. Seeding interior nodes up front makes it deterministic; leaves
 * still arrive via the production path. Idempotent on gisOfficeId, matching
 * what purge() deletes on.
 */
async function seedInteriorOffices(db: Db): Promise<void> {
  const root = await db.entity.findUnique({ where: { gisOfficeId: "1" } });
  if (!root) {
    throw new Error("The entity root (gisOfficeId 1) is missing. Run `npm run seed` first.");
  }

  const idByOfficeId = new Map<string, string>([["1", root.id]]);

  // Root-first, so each office's parent has an id by the time it is needed.
  for (const { office, path, kind } of INTERIOR_OFFICES) {
    const parentId = office.parent ? idByOfficeId.get(office.parent.id) : root.id;
    if (!parentId) {
      throw new Error(`Interior office ${office.id} names a parent that comes after it.`);
    }

    const data = {
      name: office.name,
      tag: office.tag,
      parentId,
      path,
      kind,
      countryCode: office.country,
      isActive: true,
      syncedAt: new Date(),
    };

    const entity = await db.entity.upsert({
      where: { gisOfficeId: office.id },
      update: data,
      create: { gisOfficeId: office.id, ...data },
      select: { id: true },
    });
    idByOfficeId.set(office.id, entity.id);
  }
}

// Flags are shared config, not suite data — can't just delete them. Specs
// that flip a flag on would leave it on, so the run snapshots the baseline
// and restores it rather than assuming "all off". test-results/ is wiped by
// Playwright before globalSetup and is gitignored.

const BASELINE_PATH = join(process.cwd(), "test-results", ".flag-baseline.json");

type FlagBaseline = Array<{ key: string; enabled: boolean }>;

async function captureFlags(db: Db): Promise<void> {
  const flags: FlagBaseline = await db.featureFlag.findMany({
    select: { key: true, enabled: true },
  });
  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  writeFileSync(BASELINE_PATH, JSON.stringify(flags), "utf8");
}

async function restoreFlags(db: Db): Promise<string[]> {
  let baseline: FlagBaseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as FlagBaseline;
  } catch {
    // No baseline means globalSetup never ran (e.g. a spec pointed at an
    // already-running server) — better to leave flags alone than guess.
    return [];
  }

  const current = new Map(
    (await db.featureFlag.findMany({ select: { key: true, enabled: true } })).map((flag) => [
      flag.key,
      flag.enabled,
    ])
  );

  const restored: string[] = [];
  for (const flag of baseline) {
    if (current.get(flag.key) === flag.enabled) continue;
    await db.featureFlag.update({ where: { key: flag.key }, data: { enabled: flag.enabled } });
    restored.push(flag.key);
  }

  rmSync(BASELINE_PATH, { force: true });
  return restored;
}

function describe(summary: PurgeSummary): string {
  return (
    `${summary.posts} posts, ${summary.users} accounts, ` +
    `${summary.auditEvents} audit events, ${summary.entities} entities`
  );
}

/** globalSetup: start from a known-empty state, and remember the flag settings. */
export async function prepareDatabase(): Promise<void> {
  await withDb(async (db) => {
    await captureFlags(db);
    const summary = await purge(db);
    if (Object.values(summary).some((count) => count > 0)) {
      console.log(`[e2e cleanup] Cleared debris from an earlier run: ${describe(summary)}.`);
    }
    await seedInteriorOffices(db);
  });
}

/** globalTeardown: leave the database as the run found it. */
export async function cleanUpDatabase(): Promise<void> {
  if (process.env.PULSE_E2E_KEEP_DATA === "1") {
    console.log("[e2e cleanup] PULSE_E2E_KEEP_DATA=1 — leaving this run's data in place.");
    return;
  }

  await withDb(async (db) => {
    const summary = await purge(db);
    const restored = await restoreFlags(db);
    console.log(`[e2e cleanup] Removed ${describe(summary)}.`);
    if (restored.length > 0) {
      console.log(`[e2e cleanup] Restored feature flags: ${restored.join(", ")}.`);
    }
  });
}

export const CLEANUP_MODES = ["prepare", "clean"] as const;
export type CleanupMode = (typeof CLEANUP_MODES)[number];

function isCleanupMode(value: string | undefined): value is CleanupMode {
  return (CLEANUP_MODES as readonly string[]).includes(value ?? "");
}

// Dispatches on the mode arg (not "is this the entry point") so an
// accidental import stays inert — Playwright's argv never carries these words.
const mode = process.argv[2];
if (isCleanupMode(mode)) {
  const run = mode === "prepare" ? prepareDatabase : cleanUpDatabase;
  run().catch((error: unknown) => {
    console.error(`[e2e cleanup] ${mode} failed:`, error);
    process.exit(1);
  });
} else if (process.argv[2] !== undefined) {
  console.error(
    `[e2e cleanup] Unknown mode "${mode}". Expected one of: ${CLEANUP_MODES.join(", ")}.`
  );
  process.exit(1);
}
