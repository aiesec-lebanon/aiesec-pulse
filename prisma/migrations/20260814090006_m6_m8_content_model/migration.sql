-- M6 · M7 · M8 — Production content model.
--   M6  Extend Post: slug, kind, new statuses, bodyJson/bodyText, scheduling,
--       counters. `content` → `bodyText`; `weekIso` → `quotaPeriod`.
--   M7  Create PostAudience and backfill every existing post with a GLOBAL row,
--       which preserves current visibility exactly.
--   M8  Create Topic, PostTopic, Media, PostMedia, PostVersion, EventDetail.
--       `Post.mediaUrl` becomes a Media row plus `coverMediaId`.
--
-- Legacy columns are copied, never dropped — M17 removes them once this is
-- verified.

CREATE TYPE "PostKind"  AS ENUM ('ANNOUNCEMENT', 'STORY', 'EVENT', 'OPPORTUNITY', 'RESOURCE', 'RECOGNITION');
CREATE TYPE "TopicKind" AS ENUM ('FUNCTION', 'PROGRAMME', 'GENERAL');

-- ── PostStatus: PENDING becomes IN_REVIEW ────────────────────────────────────
-- Prisma's generated enum swap casts via ::text and would fail on 'PENDING',
-- which has no counterpart in the target enum. The CASE below performs the
-- rename as part of the type change.
CREATE TYPE "PostStatus_new" AS ENUM ('DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'REJECTED', 'ARCHIVED', 'HIDDEN');
ALTER TABLE "Post" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Post" ALTER COLUMN "status" TYPE "PostStatus_new"
    USING (CASE "status"::text WHEN 'PENDING' THEN 'IN_REVIEW' ELSE "status"::text END)::"PostStatus_new";
ALTER TYPE "PostStatus" RENAME TO "PostStatus_old";
ALTER TYPE "PostStatus_new" RENAME TO "PostStatus";
DROP TYPE "PostStatus_old";
ALTER TABLE "Post" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- ── Media ────────────────────────────────────────────────────────────────────
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "checksum" TEXT,
    "altText" TEXT,
    "variants" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Media_ownerId_createdAt_idx" ON "Media"("ownerId", "createdAt" DESC);
CREATE INDEX "Media_checksum_idx" ON "Media"("checksum");

ALTER TABLE "Media" ADD CONSTRAINT "Media_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PostMedia" (
    "postId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,

    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("postId","mediaId")
);

-- ── Post: production columns ─────────────────────────────────────────────────
ALTER TABLE "Post"
    ADD COLUMN "slug"              TEXT,
    ADD COLUMN "kind"              "PostKind" NOT NULL DEFAULT 'STORY',
    ADD COLUMN "publisherEntityId" TEXT,
    ADD COLUMN "termLabel"         TEXT,
    ADD COLUMN "summary"           TEXT,
    ADD COLUMN "bodyJson"          JSONB,
    ADD COLUMN "bodyText"          TEXT,
    ADD COLUMN "readingMinutes"    INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "locale"            TEXT NOT NULL DEFAULT 'en',
    ADD COLUMN "coverMediaId"      TEXT,
    ADD COLUMN "requiresAck"       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "pinnedUntil"       TIMESTAMP(3),
    ADD COLUMN "expiresAt"         TIMESTAMP(3),
    ADD COLUMN "scheduledAt"       TIMESTAMP(3),
    ADD COLUMN "publishedAt"       TIMESTAMP(3),
    ADD COLUMN "archivedAt"        TIMESTAMP(3),
    ADD COLUMN "hiddenAt"          TIMESTAMP(3),
    ADD COLUMN "hiddenReason"      TEXT,
    ADD COLUMN "quotaPeriod"       TEXT,
    ADD COLUMN "reactionCount"     INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "commentCount"      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "readCount"         INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "audienceSize"      INTEGER NOT NULL DEFAULT 0;

-- content → bodyText, plus a ProseMirror document with one paragraph per line.
UPDATE "Post" SET "bodyText" = "content" WHERE "bodyText" IS NULL;

UPDATE "Post" p SET "bodyJson" = jsonb_build_object(
    'type', 'doc',
    'content', COALESCE(
        (SELECT jsonb_agg(
                    jsonb_build_object(
                        'type', 'paragraph',
                        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', para))
                    ) ORDER BY ord)
         FROM unnest(string_to_array(p."content", E'\n')) WITH ORDINALITY AS t(para, ord)
         WHERE btrim(para) <> ''),
        '[]'::jsonb)
);

-- Reading time at 200 wpm, floor of one minute.
UPDATE "Post" SET "readingMinutes" = GREATEST(
    1,
    CEIL(COALESCE(array_length(regexp_split_to_array(btrim("bodyText"), '\s+'), 1), 0) / 200.0)::int
);

-- Slug: title-derived, disambiguated by the tail of the cuid so uniqueness holds
-- even for entities that reuse titles ("Weekly update").
UPDATE "Post" SET "slug" =
    COALESCE(
        NULLIF(btrim(left(regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g'), 60), '-'), ''),
        'post'
    ) || '-' || right("id", 8);

UPDATE "Post" SET "quotaPeriod" = "weekIso";
UPDATE "Post" SET "publishedAt" = "createdAt" WHERE "status" = 'PUBLISHED';

-- Every historical post was network-wide, so the reach denominator is the whole
-- member base at cutover.
UPDATE "Post" SET "audienceSize" = (SELECT count(*) FROM "User") WHERE "status" = 'PUBLISHED';

UPDATE "Post" p SET "commentCount" =
    (SELECT count(*) FROM "Comment" c WHERE c."postId" = p."id" AND c."deletedAt" IS NULL);

-- Publisher entity: the author's entity, falling back to the global root.
UPDATE "Post" p SET "publisherEntityId" = COALESCE(u."primaryEntityId", 'ent_root_ai')
FROM "User" u WHERE u."id" = p."authorId";
UPDATE "Post" SET "publisherEntityId" = 'ent_root_ai' WHERE "publisherEntityId" IS NULL;

-- mediaUrl → Media row. The MVP stored a public Supabase URL; the object key is
-- everything after the bucket segment. bytes/mimeType are unknown for historical
-- uploads and are refreshed by the `media-derive` job.
INSERT INTO "Media" ("id", "ownerId", "bucket", "path", "mimeType", "bytes", "createdAt")
SELECT
    'med_mig_' || p."id",
    p."authorId",
    'post-media',
    COALESCE(substring(p."mediaUrl" FROM '/post-media/(.*)$'), p."mediaUrl"),
    CASE
        WHEN p."mediaUrl" ILIKE '%.png'  THEN 'image/png'
        WHEN p."mediaUrl" ILIKE '%.webp' THEN 'image/webp'
        WHEN p."mediaUrl" ILIKE '%.avif' THEN 'image/avif'
        ELSE 'image/jpeg'
    END,
    0,
    p."createdAt"
FROM "Post" p
WHERE p."mediaUrl" IS NOT NULL AND p."mediaUrl" <> '';

UPDATE "Post" SET "coverMediaId" = 'med_mig_' || "id"
WHERE "mediaUrl" IS NOT NULL AND "mediaUrl" <> '';

INSERT INTO "PostMedia" ("postId", "mediaId", "position")
SELECT "id", 'med_mig_' || "id", 0
FROM "Post" WHERE "mediaUrl" IS NOT NULL AND "mediaUrl" <> '';

ALTER TABLE "Post"
    ALTER COLUMN "slug" SET NOT NULL,
    ALTER COLUMN "bodyJson" SET NOT NULL,
    ALTER COLUMN "bodyText" SET NOT NULL,
    ALTER COLUMN "publisherEntityId" SET NOT NULL;

-- Prisma cannot express a generated column; M16 replaces this with the STORED
-- tsvector.
ALTER TABLE "Post" ADD COLUMN "searchVector" tsvector;

DROP INDEX "Post_status_createdAt_idx";
DROP INDEX "Post_authorId_weekIso_idx";

CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");
CREATE INDEX "Post_status_publishedAt_idx" ON "Post"("status", "publishedAt" DESC);
CREATE INDEX "Post_publisherEntityId_status_publishedAt_idx" ON "Post"("publisherEntityId", "status", "publishedAt" DESC);
CREATE INDEX "Post_authorId_quotaPeriod_status_idx" ON "Post"("authorId", "quotaPeriod", "status");
CREATE INDEX "Post_status_scheduledAt_idx" ON "Post"("status", "scheduledAt");
CREATE INDEX "Post_kind_status_publishedAt_idx" ON "Post"("kind", "status", "publishedAt" DESC);

ALTER TABLE "Post" ADD CONSTRAINT "Post_publisherEntityId_fkey"
    FOREIGN KEY ("publisherEntityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_coverMediaId_fkey"
    FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── M7 · PostAudience ────────────────────────────────────────────────────────
CREATE TABLE "PostAudience" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "entityId" TEXT,

    CONSTRAINT "PostAudience_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PostAudience_scopeType_entityId_idx" ON "PostAudience"("scopeType", "entityId");
CREATE UNIQUE INDEX "PostAudience_postId_scopeType_entityId_key" ON "PostAudience"("postId", "scopeType", "entityId");

ALTER TABLE "PostAudience" ADD CONSTRAINT "PostAudience_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostAudience" ADD CONSTRAINT "PostAudience_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Behaviour-preserving: the MVP feed showed every post to everyone.
INSERT INTO "PostAudience" ("id", "postId", "scopeType", "entityId")
SELECT 'aud_mig_' || "id", "id", 'GLOBAL', NULL FROM "Post";

-- ── M8 · Topics, versions, events ────────────────────────────────────────────
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "TopicKind" NOT NULL DEFAULT 'GENERAL',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostTopic" (
    "postId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "PostTopic_pkey" PRIMARY KEY ("postId","topicId")
);

CREATE TABLE "PostVersion" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "bodyJson" JSONB NOT NULL,
    "editedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventDetail" (
    "postId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "location" TEXT,
    "joinUrl" TEXT,
    "rsvpUrl" TEXT,

    CONSTRAINT "EventDetail_pkey" PRIMARY KEY ("postId")
);

CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");
CREATE INDEX "PostTopic_topicId_idx" ON "PostTopic"("topicId");
CREATE INDEX "PostVersion_postId_createdAt_idx" ON "PostVersion"("postId", "createdAt" DESC);
CREATE UNIQUE INDEX "PostVersion_postId_version_key" ON "PostVersion"("postId", "version");
CREATE INDEX "EventDetail_startsAt_idx" ON "EventDetail"("startsAt");

ALTER TABLE "PostTopic" ADD CONSTRAINT "PostTopic_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostTopic" ADD CONSTRAINT "PostTopic_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostVersion" ADD CONSTRAINT "PostVersion_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostVersion" ADD CONSTRAINT "PostVersion_editedById_fkey"
    FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventDetail" ADD CONSTRAINT "EventDetail_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Version 1 of every historical post, so the version history is never empty.
INSERT INTO "PostVersion" ("id", "postId", "version", "title", "bodyJson", "editedById", "changeNote", "createdAt")
SELECT 'pv_mig_' || p."id", p."id", 1, p."title", p."bodyJson", p."authorId",
       'Imported from the MVP schema at the Phase 0 cutover.', p."createdAt"
FROM "Post" p;
