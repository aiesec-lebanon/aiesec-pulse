-- Governance and operations tables. Grouped into the M13/M14 window because none
-- of them carries legacy data to migrate.
--
--   FeatureFlag         Features ship behind a flag, so a bad release is
--                       disabled without a rollback deploy.
--   RankingWeight       Feed weights tunable by platform_admin without a deploy;
--                       changes are audited.
--   DataSubjectRequest  GDPR access/export/rectification/erasure with a
--                       statutory `dueAt`.
--   SyncRun             Outcome of each GIS reconciliation run.

CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "RankingWeight" (
    "key" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankingWeight_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "handledById" TEXT,
    "notes" TEXT,

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataSubjectRequest_status_dueAt_idx" ON "DataSubjectRequest"("status", "dueAt");
CREATE INDEX "SyncRun_kind_startedAt_idx" ON "SyncRun"("kind", "startedAt" DESC);
