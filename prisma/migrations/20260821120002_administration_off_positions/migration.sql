-- Platform administration stops being an AIESEC position and becomes a separate
-- credential login. The five capabilities below had no meaning as position
-- permissions once the console gates on that login instead, so they leave the
-- catalogue rather than lingering as rows nothing consults.
--
-- `RolePermission` cascades from `Permission`, so the matrix rows go with them.
-- Nothing else references these keys: grants are unaffected, and every position
-- keeps its editorial and moderation capabilities untouched.

DELETE FROM "Permission"
WHERE "key" IN (
  'admin.configure_roles',
  'admin.configure',
  'admin.audit_view',
  'admin.privacy_execute',
  'analytics.view_network'
);

-- The three AI classes are ordinary editable rows now: nothing is locked at
-- full access, because nothing in the matrix can reach administration at all.
-- Re-grant them the whole remaining catalogue so the seeded default and the
-- database agree after the deletions above.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."key" IN ('pai', 'ai_vp', 'ai_manager')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
