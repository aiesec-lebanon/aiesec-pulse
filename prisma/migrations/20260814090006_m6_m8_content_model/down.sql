-- Rollback for M6 · M7 · M8. `Post.content`, `Post.mediaUrl` and `Post.weekIso`
-- were only copied, so reverting loses nothing written before the cutover.

DROP TABLE IF EXISTS "EventDetail";
DROP TABLE IF EXISTS "PostVersion";
DROP TABLE IF EXISTS "PostTopic";
DROP TABLE IF EXISTS "Topic";
DROP TABLE IF EXISTS "PostAudience";
DROP TABLE IF EXISTS "PostMedia";

ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_coverMediaId_fkey";
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_publisherEntityId_fkey";

DROP INDEX IF EXISTS "Post_kind_status_publishedAt_idx";
DROP INDEX IF EXISTS "Post_status_scheduledAt_idx";
DROP INDEX IF EXISTS "Post_authorId_quotaPeriod_status_idx";
DROP INDEX IF EXISTS "Post_publisherEntityId_status_publishedAt_idx";
DROP INDEX IF EXISTS "Post_status_publishedAt_idx";
DROP INDEX IF EXISTS "Post_slug_key";

ALTER TABLE "Post"
    DROP COLUMN IF EXISTS "searchVector",
    DROP COLUMN IF EXISTS "audienceSize",
    DROP COLUMN IF EXISTS "readCount",
    DROP COLUMN IF EXISTS "commentCount",
    DROP COLUMN IF EXISTS "reactionCount",
    DROP COLUMN IF EXISTS "quotaPeriod",
    DROP COLUMN IF EXISTS "hiddenReason",
    DROP COLUMN IF EXISTS "hiddenAt",
    DROP COLUMN IF EXISTS "archivedAt",
    DROP COLUMN IF EXISTS "publishedAt",
    DROP COLUMN IF EXISTS "scheduledAt",
    DROP COLUMN IF EXISTS "expiresAt",
    DROP COLUMN IF EXISTS "pinnedUntil",
    DROP COLUMN IF EXISTS "requiresAck",
    DROP COLUMN IF EXISTS "coverMediaId",
    DROP COLUMN IF EXISTS "locale",
    DROP COLUMN IF EXISTS "readingMinutes",
    DROP COLUMN IF EXISTS "bodyText",
    DROP COLUMN IF EXISTS "bodyJson",
    DROP COLUMN IF EXISTS "summary",
    DROP COLUMN IF EXISTS "termLabel",
    DROP COLUMN IF EXISTS "publisherEntityId",
    DROP COLUMN IF EXISTS "kind",
    DROP COLUMN IF EXISTS "slug";

DROP TABLE IF EXISTS "Media";

-- Restore the MVP enum. IN_REVIEW maps back to PENDING; statuses that only exist
-- in the production model are parked as PENDING for human triage.
CREATE TYPE "PostStatus_mvp" AS ENUM ('PUBLISHED', 'PENDING', 'REJECTED');
ALTER TABLE "Post" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Post" ALTER COLUMN "status" TYPE "PostStatus_mvp"
    USING (CASE "status"::text
             WHEN 'PUBLISHED' THEN 'PUBLISHED'
             WHEN 'REJECTED'  THEN 'REJECTED'
             ELSE 'PENDING'
           END)::"PostStatus_mvp";
ALTER TYPE "PostStatus" RENAME TO "PostStatus_prod";
ALTER TYPE "PostStatus_mvp" RENAME TO "PostStatus";
DROP TYPE "PostStatus_prod";
ALTER TABLE "Post" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';

CREATE INDEX "Post_status_createdAt_idx" ON "Post"("status", "createdAt" DESC);
CREATE INDEX "Post_authorId_weekIso_idx" ON "Post"("authorId", "weekIso");

DROP TYPE IF EXISTS "TopicKind";
DROP TYPE IF EXISTS "PostKind";
