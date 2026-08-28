import "dotenv/config";

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { Redis } from "@upstash/redis";

import { PrismaClient } from "@/app/generated/prisma/client";
import { ActorType } from "@/app/generated/prisma/enums";
import { cacheKeys } from "@/lib/cache-keys";

import { E2E_ADMIN } from "./admin-credentials";
import { E2E_OFFICE_IDS, E2E_PERSON_ID_PREFIX, INTERIOR_OFFICES } from "./gis-stub/fixtures";

/**
 * The suite writes to a real database through the real application — there is
 * no in-memory substitute, because the point of these specs is that the
 * production data path runs. What there must not be is a run that leaves its
 * writes behind: accumulated personas and posts change what the ranked feed
 * returns, what the entity typeahead matches, and how much work every query
 * does, so yesterday's run silently becomes today's fixture.
 *
 * So the suite owns its rows and removes them. Every account it creates carries
 * a GIS person id beginning `e2e-` (gis-stub/fixtures.ts), which no real GIS
 * person id can — those are numeric. Everything else the suite writes hangs off
 * one of those accounts or off one of the stub's offices, so that single
 * discriminator is enough to find all of it, and narrow enough that this can
 * never reach a real member's data.
 *
 * Called from both ends of the run: globalSetup clears whatever an interrupted
 * previous run left behind, globalTeardown clears this one's. Belt and braces —
 * a suite killed with Ctrl+C never reaches its teardown, and without the setup
 * sweep that debris would be permanent.
 *
 * Run as a script, never imported by Playwright: the generated Prisma client is
 * ESM and uses `import.meta`, which Playwright's CommonJS test loader cannot
 * evaluate. `e2e/cleanup-runner.ts` starts it through `npm run e2e:cleanup`,
 * which is also the way to run it by hand:
 *
 *     npm run e2e:cleanup -- clean
 */

type Db = PrismaClient;

// The seed reaches for DIRECT_URL first and so does this: teardown is a burst of
// DELETEs, which is the shape pgbouncer's transaction pooling is worst at, and
// nothing here needs the pooler.
function connectionString(): string {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Neither DIRECT_URL nor DATABASE_URL is set — cannot clean up after e2e.");
  }
  return url;
}

/**
 * The one hard stop. `PULSE_DEPLOYMENT` is what `lib/env.ts` and the test-hook
 * switch already key on, so "is this production?" has the same answer here as
 * everywhere else rather than a second, subtly different rule.
 */
function refuseOnProduction(): void {
  if (process.env.PULSE_DEPLOYMENT === "production") {
    throw new Error(
      "The e2e cleanup was invoked against the production deployment and refused. " +
        "Nothing was deleted."
    );
  }
}

async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  refuseOnProduction();
  const db = new PrismaClient({ adapter: new PrismaPg(connectionString()) });
  try {
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

// Deleting rows is only half of it. The ranked-feed window is cached per entity
// for 60s (lib/feed.ts) and flags for 15s (lib/flags.ts), so a purge that
// ignored Redis would leave the next run reading ids that no longer exist —
// trading one flake for another. Keys are named, never scanned: a wildcard
// flush would take a developer's unrelated cache with it.

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

async function forgetKeys(keys: string[]): Promise<void> {
  const client = redis();
  if (!client || keys.length === 0) return;

  // The REST transport carries the key list in the URL, so a 700-account
  // teardown has to arrive in batches rather than as one request.
  for (let i = 0; i < keys.length; i += 100) {
    try {
      await client.del(...keys.slice(i, i + 100));
    } catch (error) {
      // A stale cache entry expires within the minute; a teardown that threw
      // here would leave the database half-purged, which does not.
      console.warn("[e2e cleanup] Redis delete failed, continuing:", error);
    }
  }
}

export type PurgeSummary = {
  users: number;
  posts: number;
  entities: number;
  auditEvents: number;
};

/**
 * Order is dictated by the schema, not by preference. `Post.author`,
 * `PostVersion.editedBy`, `Report.reporter` and `Appeal.appellant` are required
 * relations, and Prisma leaves those at Restrict — so every row pointing at an
 * account has to go before the account does. Everything reached by a cascade
 * (comments, reactions, grants, sessions, notifications, …) is deliberately not
 * listed: the schema already removes it, and re-listing it here would be a
 * second copy of the cascade rules to keep in step.
 */
async function purge(db: Db): Promise<PurgeSummary> {
  const users = await db.user.findMany({
    where: { aiesecPersonId: { startsWith: E2E_PERSON_ID_PREFIX } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  // The stub's office tree, as Pulse materialised it. Fixed ids, so these do not
  // accumulate — but they are still the suite's, and a post targeted at one is
  // reachable through the entity even if its author has somehow gone already.
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
  const sessionIds = (
    await db.session.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
  ).map((session) => session.id);

  // AuditEvent carries no foreign key — `actorId` is a bare string by design, so
  // an actor can be deleted without erasing the record that they acted. That
  // makes it the one table nothing cascades into, and the one that would grow
  // without bound if this did not name it explicitly. Admin rows match on the
  // label because `adminActor` records no id (lib/audit.ts).
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

  // Before the posts: a version written by a suite account on some other post
  // would otherwise block that account's deletion. Versions on the suite's own
  // posts are taken by the cascade a moment later either way.
  await db.postVersion.deleteMany({ where: { editedById: { in: userIds } } });

  const posts = await db.post.deleteMany({ where: postFilter });

  // Post.cover is optional, so deleting the posts nulled the reference rather
  // than the row; the uploads themselves belong to the suite and go now.
  await db.media.deleteMany({ where: { ownerId: { in: userIds } } });

  // Appeals point at reports, so they unwind in that order. Neither is written
  // by any spec today — moderation is out of MVP scope — but
  // both are Restrict relations onto User, so leaving them out would turn a
  // future moderation spec into a confusing foreign-key failure here.
  await db.appeal.deleteMany({ where: { appellantId: { in: userIds } } });
  await db.report.deleteMany({
    where: { OR: [{ reporterId: { in: userIds } }, { assigneeId: { in: userIds } }] },
  });

  const deletedUsers = await db.user.deleteMany({ where: { id: { in: userIds } } });

  // Every entity's window, not just the suite's: a post targeted at Everyone —
  // which the PAI audience spec does exactly — lands in all of them. Read before
  // the entity rows go, so the list is complete.
  const feedKeys = (await db.entity.findMany({ select: { id: true } })).map((entity) =>
    cacheKeys.feedRanked(entity.id)
  );

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
      // Something outside the suite adopted it — a developer's own account with
      // this as its primary entity, say. Leave it and say so: it is one row, and
      // the fixed gisOfficeId means the next run reuses it rather than adding
      // another.
      console.warn(`[e2e cleanup] Left entity ${entity.path} in place:`, error);
    }
  }

  await forgetKeys([
    ...userIds.flatMap((id) => [cacheKeys.roleGrants(id), cacheKeys.scopeSet(id)]),
    ...sessionIds.map((id) => cacheKeys.session(id)),
    ...feedKeys,
    cacheKeys.feedRanked("none"),
    cacheKeys.entityTree(),
  ]);

  return {
    users: deletedUsers.count,
    posts: posts.count,
    entities: deletedEntities,
    auditEvents: auditEvents.count,
  };
}

/**
 * Creates the stub's interior offices before the first spec runs.
 *
 * An office enters the tree when someone holding a position there signs in, and
 * `resolveOfficeEntity` parks one whose parent is not there yet directly under
 * the root. With `fullyParallel` there is no first login, so the shape of the
 * tree — and therefore every scope set computed from it — would depend on which
 * worker happened to get there first. Creating the interior nodes up front makes
 * that deterministic; the leaves still arrive through the production path.
 *
 * Idempotent on `gisOfficeId`, which is also what the purge above deletes on, so
 * setup and teardown stay symmetric.
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

// Flags are seeded configuration rather than suite data, so they cannot simply
// be deleted — but several specs turn them on and would otherwise leave them on,
// which is a change to a shared development database that nobody asked for.
// Rather than assume the seed's "all off", the run records what it found and
// puts exactly that back. test-results/ is wiped by Playwright immediately
// before globalSetup and is gitignored.

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
    // No baseline means globalSetup never ran — a single spec file pointed at an
    // already-running server, most likely. Restoring from a guess would be worse
    // than leaving the flags alone.
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

  await forgetKeys(restored.map((key) => cacheKeys.flag(key)));
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
  // The escape hatch for debugging a failure: keep the rows and inspect them,
  // knowing the next run's globalSetup will clear them.
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

// Dispatches on the mode argument rather than on "am I the entry point?", which
// is what keeps an accidental `import` of this module inert: Playwright's own
// argv never carries one of these words.
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
