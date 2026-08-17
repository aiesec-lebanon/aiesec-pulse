-- M17 — Contract step: drop the legacy schema (UserRole, Admin, Post.weekIso,
-- Post.content). Run only after M1–M16 are verified in staging and production.
--
-- This is the only destructive migration in the chain. Everything before it was
-- expand-and-copy, so a rollback up to this point loses nothing written before
-- the cutover. Past this point the legacy columns are gone and recovery means a
-- restore from backup, so this needs a verified backup and a staging rehearsal
-- first.
--
-- The guard block below re-checks every copy this chain performed. If any column
-- or table is short by a row, the migration raises and the transaction rolls
-- back with the legacy data intact.

DO $$
DECLARE
    unmigrated_posts     bigint;
    unmigrated_comments  bigint;
    likes                bigint;
    reactions            bigint;
    legacy_audit         bigint;
    copied_audit         bigint;
BEGIN
    SELECT count(*) INTO unmigrated_posts
    FROM "Post" WHERE "bodyText" IS DISTINCT FROM "content";
    IF unmigrated_posts > 0 THEN
        RAISE EXCEPTION 'M17 blocked: % posts have bodyText out of sync with content', unmigrated_posts;
    END IF;

    SELECT count(*) INTO unmigrated_comments
    FROM "Comment" WHERE "body" IS DISTINCT FROM "content";
    IF unmigrated_comments > 0 THEN
        RAISE EXCEPTION 'M17 blocked: % comments have body out of sync with content', unmigrated_comments;
    END IF;

    SELECT count(*) INTO likes FROM "Like";
    SELECT count(*) INTO reactions FROM "Reaction" WHERE "kind" = 'LIKE';
    IF reactions < likes THEN
        RAISE EXCEPTION 'M17 blocked: % Like rows but only % LIKE reactions', likes, reactions;
    END IF;

    SELECT (SELECT count(*) FROM "AdminAction") + (SELECT count(*) FROM "UserAction") INTO legacy_audit;
    SELECT count(*) INTO copied_audit FROM "AuditEvent" WHERE "id" LIKE 'ae\_%';
    IF copied_audit < legacy_audit THEN
        RAISE EXCEPTION 'M17 blocked: % legacy audit rows but only % copied', legacy_audit, copied_audit;
    END IF;

    IF EXISTS (SELECT 1 FROM "Post" WHERE "quotaPeriod" IS DISTINCT FROM "weekIso") THEN
        RAISE EXCEPTION 'M17 blocked: quotaPeriod does not match weekIso on every post';
    END IF;
END $$;

-- ── Drop legacy tables ───────────────────────────────────────────────────────
DROP TABLE "Like";
DROP TABLE "AdminAction";
DROP TABLE "UserAction";
DROP TABLE "Admin";

-- ── Drop legacy columns ──────────────────────────────────────────────────────
DROP INDEX "User_role_idx";
DROP INDEX "User_aiesecUserId_key";

ALTER TABLE "User"
    DROP COLUMN "aiesecUserId",
    DROP COLUMN "role",
    DROP COLUMN "committeeId",
    DROP COLUMN "committeeName";

ALTER TABLE "Post"
    DROP COLUMN "content",
    DROP COLUMN "mediaUrl",
    DROP COLUMN "weekIso";

ALTER TABLE "Comment" DROP COLUMN "content";

DROP TYPE "UserRole";
