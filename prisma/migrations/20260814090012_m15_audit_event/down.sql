-- Rollback for M15. `AdminAction` and `UserAction` are still the source of
-- record at this point, so no audit history is lost. Events written to
-- AuditEvent after the cutover are lost — export them first:
--   \copy (SELECT * FROM "AuditEvent" WHERE "id" NOT LIKE 'ae\_%') TO 'audit-post-cutover.csv' CSV HEADER
DROP TABLE IF EXISTS "AuditEvent";
DROP TYPE IF EXISTS "ActorType";
