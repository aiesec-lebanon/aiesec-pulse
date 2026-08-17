-- M9 · M10 · M11 — Engagement and measurement.
--   M9   Like → Reaction, all rows kind = LIKE. Composite PK preserved.
--   M10  Extend Comment with parentId, status, depth; deletedAt → DELETED.
--   M11  Create the measurement tables. No backfill — measurement starts here.
--
-- `NotificationChannel` is created here rather than in M12 because PostDelivery
-- references it.

CREATE TYPE "ReactionKind"        AS ENUM ('LIKE', 'CELEBRATE', 'INSIGHTFUL', 'SUPPORT');
CREATE TYPE "CommentStatus"       AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED');
CREATE TYPE "FollowTarget"        AS ENUM ('TOPIC', 'ENTITY', 'USER');
CREATE TYPE "ReadSource"          AS ENUM ('FEED', 'SEARCH', 'DIGEST', 'PUSH', 'DIRECT');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- ── M9 · Like → Reaction ─────────────────────────────────────────────────────
CREATE TABLE "Reaction" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ReactionKind" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("postId","userId")
);

CREATE INDEX "Reaction_postId_kind_idx" ON "Reaction"("postId", "kind");
CREATE INDEX "Reaction_userId_createdAt_idx" ON "Reaction"("userId", "createdAt" DESC);

ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Reaction" ("postId", "userId", "kind", "createdAt")
SELECT "postId", "userId", 'LIKE', "createdAt" FROM "Like";

-- Verification: the denormalised counter must agree with the copied rows before
-- M17 is permitted to drop "Like".
UPDATE "Post" p SET "reactionCount" =
    (SELECT count(*) FROM "Reaction" r WHERE r."postId" = p."id");

DO $$
DECLARE likes bigint; reactions bigint;
BEGIN
    SELECT count(*) INTO likes FROM "Like";
    SELECT count(*) INTO reactions FROM "Reaction";
    IF likes <> reactions THEN
        RAISE EXCEPTION 'M9 reconciliation failed: % Like rows, % Reaction rows', likes, reactions;
    END IF;
END $$;

-- ── M10 · Comment threading and moderation state ─────────────────────────────
ALTER TABLE "Comment"
    ADD COLUMN "parentId"     TEXT,
    ADD COLUMN "body"         TEXT,
    ADD COLUMN "status"       "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
    ADD COLUMN "depth"        INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "editedAt"     TIMESTAMP(3),
    ADD COLUMN "hiddenAt"     TIMESTAMP(3),
    ADD COLUMN "hiddenReason" TEXT;

UPDATE "Comment" SET "body" = "content" WHERE "body" IS NULL;
UPDATE "Comment" SET "status" = 'DELETED' WHERE "deletedAt" IS NOT NULL;
ALTER TABLE "Comment" ALTER COLUMN "body" SET NOT NULL;

DROP INDEX "Comment_postId_createdAt_idx";
CREATE INDEX "Comment_postId_status_createdAt_idx" ON "Comment"("postId", "status", "createdAt");
CREATE INDEX "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt");
CREATE INDEX "Comment_userId_createdAt_idx" ON "Comment"("userId", "createdAt" DESC);

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommentMention" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CommentMention_pkey" PRIMARY KEY ("commentId","userId")
);

CREATE INDEX "CommentMention_userId_idx" ON "CommentMention"("userId");

ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── M11 · Measurement tables (no backfill — measurement starts at cutover) ───
CREATE TABLE "Bookmark" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("userId","postId")
);

CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "FollowTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostRead" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dwellMs" INTEGER NOT NULL DEFAULT 0,
    "scrollPct" INTEGER NOT NULL DEFAULT 0,
    "source" "ReadSource" NOT NULL DEFAULT 'FEED',

    CONSTRAINT "PostRead_pkey" PRIMARY KEY ("postId","userId")
);

CREATE TABLE "Acknowledgement" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Acknowledgement_pkey" PRIMARY KEY ("postId","userId")
);

CREATE TABLE "PostDelivery" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostMetricDaily" (
    "postId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "uniqueReaders" INTEGER NOT NULL DEFAULT 0,
    "reactions" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "avgDwellMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PostMetricDaily_pkey" PRIMARY KEY ("postId","day")
);

CREATE INDEX "Bookmark_userId_createdAt_idx" ON "Bookmark"("userId", "createdAt" DESC);
CREATE INDEX "Follow_targetType_targetId_idx" ON "Follow"("targetType", "targetId");
CREATE UNIQUE INDEX "Follow_userId_targetType_targetId_key" ON "Follow"("userId", "targetType", "targetId");
CREATE INDEX "PostRead_postId_firstReadAt_idx" ON "PostRead"("postId", "firstReadAt");
CREATE INDEX "PostRead_userId_lastReadAt_idx" ON "PostRead"("userId", "lastReadAt" DESC);
CREATE INDEX "Acknowledgement_postId_idx" ON "Acknowledgement"("postId");
CREATE INDEX "PostDelivery_postId_channel_idx" ON "PostDelivery"("postId", "channel");
CREATE UNIQUE INDEX "PostDelivery_postId_userId_channel_key" ON "PostDelivery"("postId", "userId", "channel");
CREATE INDEX "PostMetricDaily_day_idx" ON "PostMetricDaily"("day");

ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostRead" ADD CONSTRAINT "PostRead_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostRead" ADD CONSTRAINT "PostRead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostDelivery" ADD CONSTRAINT "PostDelivery_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostMetricDaily" ADD CONSTRAINT "PostMetricDaily_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
