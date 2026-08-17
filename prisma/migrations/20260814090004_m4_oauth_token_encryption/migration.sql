-- M4 — OAuth tokens encrypted at rest.
--
-- Plaintext tokens are not re-encrypted in place, which would require the
-- AES-GCM key inside a SQL migration. The rows are discarded instead and
-- rewritten at the user's next sign-in. The cost is one silent
-- re-authentication, which M3 already forces.

DELETE FROM "OauthToken";

ALTER TABLE "OauthToken"
    DROP COLUMN "accessToken",
    DROP COLUMN "refreshToken",
    ADD COLUMN "accessTokenEnc"  BYTEA NOT NULL,
    ADD COLUMN "refreshTokenEnc" BYTEA NOT NULL,
    ADD COLUMN "scope"           TEXT,
    ADD COLUMN "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Prisma's @updatedAt is applied client-side; the DDL default above exists only
-- so the ADD COLUMN succeeds on a non-empty table in a future re-run.
ALTER TABLE "OauthToken" ALTER COLUMN "updatedAt" DROP DEFAULT;
