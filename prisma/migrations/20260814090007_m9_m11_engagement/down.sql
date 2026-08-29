-- Rollback for M9 · M10 · M11. `Like` and `Comment.content` are untouched by the
-- forward migration, so reverting restores the MVP engagement model intact.
-- Reactions and comments created after the cutover are lost — the cutover
-- runbook therefore requires the rollback decision inside the maintenance window.

DROP TABLE IF EXISTS "PostMetricDaily";
DROP TABLE IF EXISTS "PostDelivery";
DROP TABLE IF EXISTS "Acknowledgement";
DROP TABLE IF EXISTS "PostRead";
DROP TABLE IF EXISTS "Follow";
DROP TABLE IF EXISTS "Bookmark";
DROP TABLE IF EXISTS "CommentMention";

ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_parentId_fkey";
DROP INDEX IF EXISTS "Comment_userId_createdAt_idx";
DROP INDEX IF EXISTS "Comment_parentId_createdAt_idx";
DROP INDEX IF EXISTS "Comment_postId_status_createdAt_idx";
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");

ALTER TABLE "Comment"
    DROP COLUMN IF EXISTS "hiddenReason",
    DROP COLUMN IF EXISTS "hiddenAt",
    DROP COLUMN IF EXISTS "editedAt",
    DROP COLUMN IF EXISTS "depth",
    DROP COLUMN IF EXISTS "status",
    DROP COLUMN IF EXISTS "body",
    DROP COLUMN IF EXISTS "parentId";

DROP TABLE IF EXISTS "Reaction";

DROP TYPE IF EXISTS "NotificationChannel";
DROP TYPE IF EXISTS "ReadSource";
DROP TYPE IF EXISTS "FollowTarget";
DROP TYPE IF EXISTS "CommentStatus";
DROP TYPE IF EXISTS "ReactionKind";
