-- M19 — Post level and promotion.
--
-- Reach becomes a property of the post rather than of the viewer. Everything an
-- LC or MC publishes starts LOCAL — visible inside the publisher's own MC
-- subtree — and an MCP promotes it to NETWORK under a quota counted per MC.

CREATE TYPE "PostLevel" AS ENUM ('LOCAL', 'NETWORK');

ALTER TABLE "Post"
    ADD COLUMN "level"           "PostLevel" NOT NULL DEFAULT 'LOCAL',
    ADD COLUMN "promotedAt"      TIMESTAMP(3),
    ADD COLUMN "promotedById"    TEXT,
    ADD COLUMN "promotionNote"   TEXT,
    ADD COLUMN "promotionPeriod" TEXT;

ALTER TABLE "Post" ADD CONSTRAINT "Post_promotedById_fkey"
    FOREIGN KEY ("promotedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill, so no already-published post loses reach at migration. Under the
-- previous model a GLOBAL audience row was the whole network, so those posts
-- become NETWORK; everything else was already confined to named entities and
-- becomes LOCAL, which the column default has already written.
--
-- Deliberately no promoter, note or period: nobody promoted these and no quota
-- window was spent on them. `promotedById IS NULL AND level = 'NETWORK'` is
-- exactly the set that predates promotion.
UPDATE "Post" p
SET "level" = 'NETWORK'
WHERE EXISTS (
    SELECT 1 FROM "PostAudience" a
    WHERE a."postId" = p."id" AND a."scopeType" = 'GLOBAL'
);

-- Serves the network arm of the feed union.
CREATE INDEX "Post_level_status_publishedAt_idx"
    ON "Post"("level", "status", "publishedAt" DESC);

-- Promotion quota counting, per promoter per window.
CREATE INDEX "Post_promotedById_promotionPeriod_idx"
    ON "Post"("promotedById", "promotionPeriod");

-- ── Promotion quota ──────────────────────────────────────────────────────────
-- The unique key widens by `postLevel`, so one role can carry a publishing
-- allowance and a promotion allowance at the same scope and period. Every
-- existing row is a publishing allowance and takes the LOCAL default.
ALTER TABLE "QuotaPolicy" ADD COLUMN "postLevel" "PostLevel" NOT NULL DEFAULT 'LOCAL';

DROP INDEX "QuotaPolicy_scopeType_entityId_roleKey_period_key";

CREATE UNIQUE INDEX "QuotaPolicy_scopeType_entityId_roleKey_postLevel_period_key"
    ON "QuotaPolicy"("scopeType", "entityId", "roleKey", "postLevel", "period");

-- The network-wide defaults, one per class seeded with `post.promote`. An MC
-- gets one promotion a week: the budget is the whole point of the mechanism, so
-- it starts tight and an admin widens it per MC (M20) rather than starting wide
-- and hoping. The AI classes are not the flooding risk the valve exists for and
-- keep their publishing allowances.
INSERT INTO "QuotaPolicy" ("id", "scopeType", "entityId", "roleKey", "postLevel", "period", "maxPosts") VALUES
  ('quota_network_mc_president', 'GLOBAL', NULL, 'mc_president', 'NETWORK', 'ISO_WEEK', 1),
  ('quota_network_ai_manager',   'GLOBAL', NULL, 'ai_manager',   'NETWORK', 'ISO_WEEK', 20),
  ('quota_network_ai_vp',        'GLOBAL', NULL, 'ai_vp',        'NETWORK', 'ISO_WEEK', 100),
  ('quota_network_pai',          'GLOBAL', NULL, 'pai',          'NETWORK', 'ISO_WEEK', 100)
ON CONFLICT ("id") DO NOTHING;
