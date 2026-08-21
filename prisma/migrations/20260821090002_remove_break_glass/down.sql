-- Rollback for the break-glass removal. Structural only: the enum value and the
-- table come back empty. Which historical `AuditEvent` rows were originally
-- BREAK_GLASS is not recoverable from the schema — their `action` still reads
-- `break_glass.*`, which is how you would find them — and no credential is
-- restored, so anyone rolling back must re-enrol from scratch.

ALTER TYPE "ActorType" ADD VALUE IF NOT EXISTS 'BREAK_GLASS';

CREATE TABLE IF NOT EXISTS "BreakGlassAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecretEnc" BYTEA,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakGlassAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BreakGlassAdmin_email_key" ON "BreakGlassAdmin"("email");
