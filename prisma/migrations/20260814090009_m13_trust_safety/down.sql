-- Rollback for M13.
DROP TABLE IF EXISTS "UserRestriction";
DROP TABLE IF EXISTS "Appeal";
DROP TABLE IF EXISTS "Report";
DROP TYPE IF EXISTS "AppealStatus";
DROP TYPE IF EXISTS "ReportSeverity";
DROP TYPE IF EXISTS "ReportStatus";
DROP TYPE IF EXISTS "ReportReason";
