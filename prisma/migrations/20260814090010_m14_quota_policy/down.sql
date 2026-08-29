-- Rollback for M14. The 2/ISO-week limit reverts to the constant in the code.
DROP TABLE IF EXISTS "QuotaPolicy";
DROP TYPE IF EXISTS "QuotaPeriod";
