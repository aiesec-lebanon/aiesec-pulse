-- M15 — Unified append-only audit: AdminAction and UserAction become AuditEvent.
--
-- The old tables are dropped in M17. The verification block below is what earns
-- the right to run it: if the copy is short by a single row this migration
-- aborts and rolls back, so M17 never sees an unreconciled audit trail.
--
-- `actorLabel` is denormalised at copy time so the record stays meaningful after
-- erasure nulls `actorId`.

CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'BREAK_GLASS');

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "entityId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt" DESC);
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt" DESC);
CREATE INDEX "AuditEvent_targetType_targetId_createdAt_idx" ON "AuditEvent"("targetType", "targetId", "createdAt" DESC);
CREATE INDEX "AuditEvent_entityId_createdAt_idx" ON "AuditEvent"("entityId", "createdAt" DESC);

-- MVP admins acted through the local password system, which survives only as
-- break-glass — so their historical actions are attributed to BREAK_GLASS and
-- `actorId` points at the BreakGlassAdmin row M5 created from the same Admin.
INSERT INTO "AuditEvent" ("id", "actorType", "actorId", "actorLabel", "action", "targetType", "targetId", "metadata", "createdAt")
SELECT 'ae_adm_' || aa."id", 'BREAK_GLASS', 'bg_' || aa."adminId", a."email",
       aa."action", aa."targetType", aa."targetId", aa."metadata", aa."createdAt"
FROM "AdminAction" aa
JOIN "Admin" a ON a."id" = aa."adminId";

INSERT INTO "AuditEvent" ("id", "actorType", "actorId", "actorLabel", "action", "targetType", "targetId", "entityId", "metadata", "createdAt")
SELECT 'ae_usr_' || ua."id", 'USER', ua."userId", u."fullName",
       ua."action", ua."targetType", ua."targetId", u."primaryEntityId", ua."metadata", ua."createdAt"
FROM "UserAction" ua
JOIN "User" u ON u."id" = ua."userId";

DO $$
DECLARE legacy bigint; copied bigint;
BEGIN
    SELECT (SELECT count(*) FROM "AdminAction") + (SELECT count(*) FROM "UserAction") INTO legacy;
    SELECT count(*) INTO copied FROM "AuditEvent";
    IF legacy <> copied THEN
        RAISE EXCEPTION
            'M15 reconciliation failed: % legacy audit rows, % AuditEvent rows. M17 must not run.',
            legacy, copied;
    END IF;
END $$;
