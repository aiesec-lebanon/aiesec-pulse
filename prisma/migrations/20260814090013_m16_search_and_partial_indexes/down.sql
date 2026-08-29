-- Rollback for M16. Restores the plain (non-generated) column M6 created, so the
-- chain can be rewound through M6 without a type conflict.
DROP INDEX IF EXISTS "Post_due_idx";
DROP INDEX IF EXISTS "Post_feed_idx";
DROP INDEX IF EXISTS "Entity_name_trgm_idx";
DROP INDEX IF EXISTS "Post_searchVector_idx";
ALTER TABLE "Post" DROP COLUMN IF EXISTS "searchVector";
ALTER TABLE "Post" ADD COLUMN "searchVector" tsvector;
-- pg_trgm is left installed; dropping a shared extension is not safe to automate.
