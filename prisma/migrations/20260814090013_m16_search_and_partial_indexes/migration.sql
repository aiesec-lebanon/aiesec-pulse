-- M16 — Raw-SQL additions Prisma cannot express.
--
-- M6 created "searchVector" as a plain tsvector column, because that is all the
-- Prisma datamodel can describe. This replaces it with the STORED generated
-- column, so Postgres maintains the vector rather than application code that
-- could forget to.
--
-- 'simple' rather than 'english', because content is multilingual. Per-locale
-- dictionaries can come later by making the expression locale-aware and
-- reindexing.

ALTER TABLE "Post" DROP COLUMN "searchVector";

ALTER TABLE "Post" ADD COLUMN "searchVector" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce("title", '')),    'A') ||
        setweight(to_tsvector('simple', coalesce("summary", '')),  'B') ||
        setweight(to_tsvector('simple', coalesce("bodyText", '')), 'C')
    ) STORED;

CREATE INDEX "Post_searchVector_idx" ON "Post" USING GIN ("searchVector");

-- Trigram index for author/entity name lookahead in filter bars.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Entity_name_trgm_idx" ON "Entity" USING GIN ("name" gin_trgm_ops);

-- Partial index: the feed only ever reads published posts.
CREATE INDEX "Post_feed_idx" ON "Post" ("publishedAt" DESC)
    WHERE "status" = 'PUBLISHED';

-- Scheduler hot path — `publish-scheduled` runs every minute.
CREATE INDEX "Post_due_idx" ON "Post" ("scheduledAt")
    WHERE "status" = 'SCHEDULED';
