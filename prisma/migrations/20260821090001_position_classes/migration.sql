-- Replaces the eight Pulse-invented role keys with the eight AIESEC position
-- classes (architecture.md §7.1, context.md §7.1). No schema change: `Role.key`
-- and `QuotaPolicy.roleKey` are already free-form strings. This is a data
-- migration of the catalogue itself.
--
-- Retired role grants are DELETED rather than remapped, and that is deliberate.
-- The old keys do not map onto the new ones without inventing authority GIS
-- never conferred — an `entity_publisher` grant does not record whether its
-- holder was an MCVP or an LCP — and §6.2 is explicit that grants are not
-- Pulse's to make. Every sign-in reconciles grants from GIS unconditionally, so
-- a member's real authority is restored the next time they log in. Nothing
-- historical is lost: post attribution lives on `Post.authorId` /
-- `Post.publisherEntityId`, and any manual grant that ever existed is still in
-- `AuditEvent`.
--
-- `member` survives as a class, so no one loses read or engagement access here.

-- ── Retire `admin.grant_role` ────────────────────────────────────────────────
-- Grants come from GIS and are never editable, so the permission to make one
-- has no meaning. `admin.configure_roles` replaces it: it edits the role →
-- permission matrix, never the grants themselves.
DELETE FROM "Permission" WHERE "key" = 'admin.grant_role';

-- ── New permissions ──────────────────────────────────────────────────────────
INSERT INTO "Permission" ("id", "key", "name") VALUES
  ('perm_post_promote',           'post.promote',           'Promote a post to network level'),
  ('perm_post_demote',            'post.demote',            'Return a promoted post to local level'),
  ('perm_admin_configure_roles',  'admin.configure_roles',  'Edit the role → permission matrix')
ON CONFLICT ("key") DO NOTHING;

-- ── Position classes ─────────────────────────────────────────────────────────
-- `member` already exists from the M2 catalogue and is re-described in place.
INSERT INTO "Role" ("id", "key", "name", "description") VALUES
  ('role_pai',          'pai',          'PAI',        'President of AIESEC International. Full access, locked in code.'),
  ('role_ai_vp',        'ai_vp',        'AIVP',       'Vice President of AIESEC International. Full access, locked in code.'),
  ('role_ai_manager',   'ai_manager',   'AI Manager', 'AIESEC International manager — global reach, fully configurable.'),
  ('role_mc_president', 'mc_president', 'MCP',        'Member Committee President — own MC and every LC beneath it. Promotes posts.'),
  ('role_mc_vp',        'mc_vp',        'MCVP',       'Member Committee Vice President — own MC and every LC beneath it.'),
  ('role_lc_president', 'lc_president', 'LCP',        'Local Committee President — own LC.'),
  ('role_lc_vp',        'lc_vp',        'LCVP',       'Local Committee Vice President — own LC.')
ON CONFLICT ("key") DO NOTHING;

UPDATE "Role"
SET "name" = 'Member', "description" = 'Every AIESEC member. Read and engage.'
WHERE "key" = 'member';

-- ── Drop the retired classes ─────────────────────────────────────────────────
-- `RoleGrant_roleId_fkey` is ON DELETE RESTRICT, so the grants go first.
DO $do$
DECLARE
  retired TEXT[] := ARRAY[
    'entity_publisher', 'entity_editor', 'entity_moderator',
    'global_publisher', 'global_moderator', 'platform_admin', 'break_glass_admin'
  ];
  dropped_grants INT;
  dropped_quotas INT;
BEGIN
  DELETE FROM "RoleGrant" g
  USING "Role" r
  WHERE g."roleId" = r."id" AND r."key" = ANY(retired);
  GET DIAGNOSTICS dropped_grants = ROW_COUNT;

  -- RolePermission cascades from Role.
  DELETE FROM "Role" WHERE "key" = ANY(retired);

  DELETE FROM "QuotaPolicy" WHERE "roleKey" = ANY(retired);
  GET DIAGNOSTICS dropped_quotas = ROW_COUNT;

  RAISE NOTICE 'Position classes: dropped % retired role grants and % quota policies. Authority is restored from GIS at next sign-in.',
    dropped_grants, dropped_quotas;
END
$do$;

-- ── Role to permission matrix (seeded default, editable from M18) ────────────
-- Rebuilt from scratch so the table matches context.md §7.3 exactly rather than
-- accumulating whatever the M2 seed left behind.
DELETE FROM "RolePermission";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM (VALUES
  ('member',        'comment.create'),
  ('member',        'comment.delete_own'),

  ('lc_vp',         'comment.create'),
  ('lc_vp',         'comment.delete_own'),
  ('lc_vp',         'post.draft'),
  ('lc_vp',         'post.publish'),
  ('lc_vp',         'post.schedule'),
  ('lc_vp',         'analytics.view_own'),

  ('lc_president',  'comment.create'),
  ('lc_president',  'comment.delete_own'),
  ('lc_president',  'post.draft'),
  ('lc_president',  'post.publish'),
  ('lc_president',  'post.schedule'),
  ('lc_president',  'post.require_ack'),
  ('lc_president',  'post.approve'),
  ('lc_president',  'post.edit_any'),
  ('lc_president',  'post.archive'),
  ('lc_president',  'moderation.hide'),
  ('lc_president',  'moderation.restore'),
  ('lc_president',  'moderation.report_triage'),
  ('lc_president',  'moderation.appeal_decide'),
  ('lc_president',  'analytics.view_own'),
  ('lc_president',  'analytics.view_entity'),
  ('lc_president',  'admin.audit_view'),

  ('mc_vp',         'comment.create'),
  ('mc_vp',         'comment.delete_own'),
  ('mc_vp',         'post.draft'),
  ('mc_vp',         'post.publish'),
  ('mc_vp',         'post.schedule'),
  ('mc_vp',         'post.require_ack'),
  ('mc_vp',         'post.approve'),
  ('mc_vp',         'post.edit_any'),
  ('mc_vp',         'post.archive'),
  ('mc_vp',         'analytics.view_own'),
  ('mc_vp',         'analytics.view_entity'),

  ('mc_president',  'comment.create'),
  ('mc_president',  'comment.delete_own'),
  ('mc_president',  'post.draft'),
  ('mc_president',  'post.publish'),
  ('mc_president',  'post.schedule'),
  ('mc_president',  'post.require_ack'),
  ('mc_president',  'post.approve'),
  ('mc_president',  'post.edit_any'),
  ('mc_president',  'post.archive'),
  ('mc_president',  'post.promote'),
  ('mc_president',  'post.demote'),
  ('mc_president',  'moderation.hide'),
  ('mc_president',  'moderation.restore'),
  ('mc_president',  'moderation.report_triage'),
  ('mc_president',  'moderation.appeal_decide'),
  ('mc_president',  'moderation.restrict_user'),
  ('mc_president',  'analytics.view_own'),
  ('mc_president',  'analytics.view_entity'),
  ('mc_president',  'admin.audit_view')
) AS m(role_key, perm_key)
JOIN "Role" r ON r."key" = m.role_key
JOIN "Permission" p ON p."key" = m.perm_key;

-- `pai` and `ai_vp` are locked at full access in code as well (lib/rbac/can.ts);
-- these rows keep the database honest rather than being the guarantee itself.
-- `ai_manager` also starts at full access, but as an ordinary editable row.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."key" IN ('pai', 'ai_vp', 'ai_manager');

-- ── Publishing quota defaults ────────────────────────────────────────────────
-- The per-author LOCAL publishing allowance, carried over at the tiers the
-- retired keys used. The NETWORK promotion quota is a separate policy row and
-- arrives with the promotion model (M19/M20).
INSERT INTO "QuotaPolicy" ("id", "scopeType", "entityId", "roleKey", "period", "maxPosts") VALUES
  ('quota_default_lc_vp',        'GLOBAL', NULL, 'lc_vp',        'ISO_WEEK', 2),
  ('quota_default_lc_president', 'GLOBAL', NULL, 'lc_president', 'ISO_WEEK', 2),
  ('quota_default_mc_vp',        'GLOBAL', NULL, 'mc_vp',        'ISO_WEEK', 2),
  ('quota_default_mc_president', 'GLOBAL', NULL, 'mc_president', 'ISO_WEEK', 2),
  ('quota_default_ai_manager',   'GLOBAL', NULL, 'ai_manager',   'ISO_WEEK', 20),
  ('quota_default_ai_vp',        'GLOBAL', NULL, 'ai_vp',        'ISO_WEEK', 100),
  ('quota_default_pai',          'GLOBAL', NULL, 'pai',          'ISO_WEEK', 100)
ON CONFLICT ("id") DO NOTHING;
