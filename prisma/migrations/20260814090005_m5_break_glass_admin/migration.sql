-- M5 — Retire the parallel admin identity system in favour of AIESEC OAuth plus
-- a platform_admin grant, and create BreakGlassAdmin.
--
-- Linking each admin to an AIESEC identity cannot be done in SQL: nothing
-- connects an `Admin.email` to an `aiesecPersonId`, and guessing would silently
-- hand global privilege to the wrong account. So this does only the half it can
-- prove — existing credentials are carried into BreakGlassAdmin, deactivated
-- until TOTP enrolment. Granting `platform_admin` is a separate, audited step.
--
-- Nothing is lost: the Admin table itself survives until M17.

CREATE TABLE "BreakGlassAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecretEnc" BYTEA,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakGlassAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BreakGlassAdmin_email_key" ON "BreakGlassAdmin"("email");

-- Carry MVP admin credentials over, inactive. `break-glass:enrol` (see
-- prisma/seed/break-glass.ts) activates an account once TOTP is registered.
INSERT INTO "BreakGlassAdmin" ("id", "email", "passwordHash", "isActive", "createdAt")
SELECT 'bg_' || a."id", a."email", a."passwordHash", false, a."createdAt"
FROM "Admin" a
ON CONFLICT ("email") DO NOTHING;
