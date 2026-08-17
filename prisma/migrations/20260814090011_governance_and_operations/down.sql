-- Rollback for the governance and operations tables. No pre-cutover data lives
-- here; open data subject requests must be exported before rewinding.
DROP TABLE IF EXISTS "SyncRun";
DROP TABLE IF EXISTS "DataSubjectRequest";
DROP TABLE IF EXISTS "RankingWeight";
DROP TABLE IF EXISTS "FeatureFlag";
