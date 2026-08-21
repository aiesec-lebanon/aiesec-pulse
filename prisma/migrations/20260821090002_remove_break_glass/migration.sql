-- M17 — Delete the break-glass admin path (architecture.md ADR-027, context.md
-- §7). AIESEC OAuth is the sole identity authority; a local-credential bypass of
-- it is a back door regardless of how loudly it is audited, and it has no
-- offboarding story when a term ends.
--
-- The M5 migration that created `BreakGlassAdmin` is deliberately left in place
-- rather than deleted. It has already been applied to every environment, and
-- removing an applied migration folder makes `prisma migrate` report the history
-- as diverged. The forward migration is the record of the decision.

-- ── Retain the audit trail, drop the actor kind ──────────────────────────────
-- Rows written by a break-glass session keep their action, actor id, label, IP
-- hash and timestamp. Only the enum they point at changes, because
-- `ActorType.BREAK_GLASS` ceases to exist. SYSTEM is the honest replacement: the
-- actor was not a Pulse user, and the `break_glass.*` action string still says
-- exactly what happened. Deleting the rows instead would destroy the one record
-- that says the emergency path was ever used.
UPDATE "AuditEvent" SET "actorType" = 'SYSTEM' WHERE "actorType" = 'BREAK_GLASS';

DROP TABLE IF EXISTS "BreakGlassAdmin";

-- Postgres cannot remove a value from an enum in place, so the type is rebuilt
-- and the column recast. `AuditEvent."actorType"` is the only column that uses
-- it, and the UPDATE above guarantees no surviving row carries the dropped
-- value — the cast would fail loudly rather than silently if one did.
ALTER TYPE "ActorType" RENAME TO "ActorType_old";

CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM');

ALTER TABLE "AuditEvent"
  ALTER COLUMN "actorType" TYPE "ActorType" USING ("actorType"::text::"ActorType");

DROP TYPE "ActorType_old";
