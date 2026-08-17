-- Rollback for M4. Encrypted rows are discarded; users re-authenticate once.
DELETE FROM "OauthToken";

ALTER TABLE "OauthToken"
    DROP COLUMN IF EXISTS "updatedAt",
    DROP COLUMN IF EXISTS "scope",
    DROP COLUMN IF EXISTS "refreshTokenEnc",
    DROP COLUMN IF EXISTS "accessTokenEnc",
    ADD COLUMN "accessToken"  TEXT NOT NULL,
    ADD COLUMN "refreshToken" TEXT NOT NULL;
