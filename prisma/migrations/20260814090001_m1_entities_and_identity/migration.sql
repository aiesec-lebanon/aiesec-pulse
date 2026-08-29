-- M1 — Organisation tree + identity columns.
-- Creates Entity, seeded from GIS offices, and backfills User.primaryEntityId.
--
-- Non-destructive: every legacy column survives here and is dropped only by M17,
-- once M1–M16 are verified (expand · migrate · contract).

-- ── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "EntityKind" AS ENUM ('GLOBAL', 'REGION', 'MC', 'LC');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'RESTRICTED', 'SUSPENDED', 'ERASED');

-- ── Entity ───────────────────────────────────────────────────────────────────
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "gisOfficeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "kind" "EntityKind" NOT NULL,
    "parentId" TEXT,
    "path" TEXT NOT NULL DEFAULT '',
    "countryCode" CHAR(2),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Entity_gisOfficeId_key" ON "Entity"("gisOfficeId");
CREATE INDEX "Entity_kind_isActive_idx" ON "Entity"("kind", "isActive");
CREATE INDEX "Entity_parentId_idx" ON "Entity"("parentId");
CREATE INDEX "Entity_path_idx" ON "Entity"("path");

ALTER TABLE "Entity" ADD CONSTRAINT "Entity_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bootstrap root. `sync-entities` (jobs/sync-entities.ts) reconciles the real
-- tree from GIS; this row guarantees every backfill below has a valid target and
-- that NETWORK-audience posts always resolve.
INSERT INTO "Entity" ("id", "gisOfficeId", "name", "tag", "kind", "path", "updatedAt")
VALUES ('ent_root_ai', '1', 'AIESEC International', 'AI', 'GLOBAL', '/ai', CURRENT_TIMESTAMP);

-- ── User: production identity columns ────────────────────────────────────────
ALTER TABLE "User"
    ADD COLUMN "aiesecPersonId"  TEXT,
    ADD COLUMN "email"           TEXT,
    ADD COLUMN "avatarUrl"       TEXT,
    ADD COLUMN "primaryEntityId" TEXT,
    ADD COLUMN "locale"          TEXT NOT NULL DEFAULT 'en',
    ADD COLUMN "timezone"        TEXT NOT NULL DEFAULT 'UTC',
    ADD COLUMN "status"          "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "lastSyncedAt"    TIMESTAMP(3),
    ADD COLUMN "lastSeenAt"      TIMESTAMP(3),
    ADD COLUMN "erasedAt"        TIMESTAMP(3);

-- Rename-by-copy so the MVP column stays readable until M17.
UPDATE "User" SET "aiesecPersonId" = "aiesecUserId" WHERE "aiesecPersonId" IS NULL;
ALTER TABLE "User" ALTER COLUMN "aiesecPersonId" SET NOT NULL;

-- Backfill primary entity from the MVP's single committee reference. Offices we
-- have never seen are created as MC placeholders under the root and corrected by
-- the first `sync-entities` run.
INSERT INTO "Entity" ("id", "gisOfficeId", "name", "kind", "parentId", "path", "updatedAt")
SELECT
    'ent_mig_' || u."committeeId",
    u."committeeId",
    COALESCE(NULLIF(u."committeeName", ''), 'Office ' || u."committeeId"),
    'MC',
    'ent_root_ai',
    '/ai/' || lower(u."committeeId"),
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON ("committeeId") "committeeId", "committeeName"
    FROM "User"
    WHERE "committeeId" IS NOT NULL AND "committeeId" <> ''
    ORDER BY "committeeId", "updatedAt" DESC
) u
ON CONFLICT ("gisOfficeId") DO NOTHING;

UPDATE "User" u
SET "primaryEntityId" = e."id"
FROM "Entity" e
WHERE e."gisOfficeId" = u."committeeId" AND u."committeeId" IS NOT NULL;

-- Members with no committee on record are attributed to the global entity so
-- that scope resolution always terminates.
UPDATE "User" SET "primaryEntityId" = 'ent_root_ai' WHERE "primaryEntityId" IS NULL;

CREATE UNIQUE INDEX "User_aiesecPersonId_key" ON "User"("aiesecPersonId");
CREATE INDEX "User_primaryEntityId_idx" ON "User"("primaryEntityId");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_lastSeenAt_idx" ON "User"("lastSeenAt" DESC);

ALTER TABLE "User" ADD CONSTRAINT "User_primaryEntityId_fkey"
    FOREIGN KEY ("primaryEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
