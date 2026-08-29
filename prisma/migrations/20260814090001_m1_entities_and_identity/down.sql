-- Rollback for M1. Applied manually as part of a cutover rollback.
-- Safe: no MVP column was dropped by M1, so nothing is lost.

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_primaryEntityId_fkey";

DROP INDEX IF EXISTS "User_lastSeenAt_idx";
DROP INDEX IF EXISTS "User_status_idx";
DROP INDEX IF EXISTS "User_primaryEntityId_idx";
DROP INDEX IF EXISTS "User_aiesecPersonId_key";

ALTER TABLE "User"
    DROP COLUMN IF EXISTS "erasedAt",
    DROP COLUMN IF EXISTS "lastSeenAt",
    DROP COLUMN IF EXISTS "lastSyncedAt",
    DROP COLUMN IF EXISTS "status",
    DROP COLUMN IF EXISTS "timezone",
    DROP COLUMN IF EXISTS "locale",
    DROP COLUMN IF EXISTS "primaryEntityId",
    DROP COLUMN IF EXISTS "avatarUrl",
    DROP COLUMN IF EXISTS "email",
    DROP COLUMN IF EXISTS "aiesecPersonId";

DROP TABLE IF EXISTS "Entity";
DROP TYPE IF EXISTS "UserStatus";
DROP TYPE IF EXISTS "EntityKind";
