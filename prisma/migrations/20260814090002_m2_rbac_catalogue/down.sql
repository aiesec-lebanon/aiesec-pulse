-- Rollback for M2. `User.role` was never touched, so authorisation reverts to
-- the MVP enum with no data loss.

DROP TABLE IF EXISTS "RoleGrant";
DROP TABLE IF EXISTS "RolePermission";
DROP TABLE IF EXISTS "Permission";
DROP TABLE IF EXISTS "Role";
DROP TYPE IF EXISTS "GrantSource";
DROP TYPE IF EXISTS "ScopeType";
