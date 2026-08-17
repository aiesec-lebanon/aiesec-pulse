-- M14 — Publishing quotas as configuration.
--
-- A hard-coded "2 per ISO week" becomes (scope, role, period) → max posts,
-- administered at runtime. The seeded rows reproduce the previous behaviour
-- exactly, so nothing changes at cutover.

CREATE TYPE "QuotaPeriod" AS ENUM ('ISO_WEEK', 'CALENDAR_MONTH');

CREATE TABLE "QuotaPolicy" (
    "id" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "entityId" TEXT,
    "roleKey" TEXT NOT NULL,
    "period" "QuotaPeriod" NOT NULL DEFAULT 'ISO_WEEK',
    "maxPosts" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "QuotaPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuotaPolicy_scopeType_entityId_roleKey_period_key"
    ON "QuotaPolicy"("scopeType", "entityId", "roleKey", "period");

ALTER TABLE "QuotaPolicy" ADD CONSTRAINT "QuotaPolicy_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "QuotaPolicy" ("id", "scopeType", "entityId", "roleKey", "period", "maxPosts") VALUES
  ('quota_default_entity_publisher', 'GLOBAL', NULL, 'entity_publisher', 'ISO_WEEK', 2),
  ('quota_default_entity_editor',    'GLOBAL', NULL, 'entity_editor',    'ISO_WEEK', 2),
  ('quota_default_global_publisher', 'GLOBAL', NULL, 'global_publisher', 'ISO_WEEK', 20),
  ('quota_default_platform_admin',   'GLOBAL', NULL, 'platform_admin',   'ISO_WEEK', 100);
