-- M2 — Scoped RBAC. Creates the role and permission catalogue and backfills
-- grants from the legacy UserRole enum.
--
-- The catalogue is seeded here rather than in prisma/seed.ts because the grant
-- backfill below needs the role ids to exist in the same transaction. The seed
-- re-upserts identical keys, so both paths converge.

CREATE TYPE "ScopeType" AS ENUM ('GLOBAL', 'REGION', 'ENTITY');
CREATE TYPE "GrantSource" AS ENUM ('GIS', 'MANUAL');

CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

CREATE TABLE "RoleGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "scopeEntityId" TEXT,
    "termLabel" TEXT,
    "gisPositionId" TEXT,
    "source" "GrantSource" NOT NULL DEFAULT 'GIS',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE INDEX "RoleGrant_userId_revokedAt_endsAt_idx" ON "RoleGrant"("userId", "revokedAt", "endsAt");
CREATE INDEX "RoleGrant_scopeEntityId_roleId_idx" ON "RoleGrant"("scopeEntityId", "roleId");
CREATE INDEX "RoleGrant_endsAt_idx" ON "RoleGrant"("endsAt");
CREATE UNIQUE INDEX "RoleGrant_userId_roleId_scopeType_scopeEntityId_termLabel_key"
    ON "RoleGrant"("userId", "roleId", "scopeType", "scopeEntityId", "termLabel");

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleGrant" ADD CONSTRAINT "RoleGrant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleGrant" ADD CONSTRAINT "RoleGrant_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoleGrant" ADD CONSTRAINT "RoleGrant_scopeEntityId_fkey"
    FOREIGN KEY ("scopeEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Role catalogue ───────────────────────────────────────────────────────────
INSERT INTO "Role" ("id", "key", "name", "description") VALUES
  ('role_member',            'member',            'Member',            'Every authenticated AIESEC member.'),
  ('role_entity_publisher',  'entity_publisher',  'Entity publisher',  'MCP, MCVP, LCP and functional team leads — publishes for their entity.'),
  ('role_entity_editor',     'entity_editor',     'Entity editor',     'MC comms/IM team — edits and approves within their entity.'),
  ('role_entity_moderator',  'entity_moderator',  'Entity moderator',  'Nominated per MC — moderation only, within their entity.'),
  ('role_global_publisher',  'global_publisher',  'Global publisher',  'AI teams — publishes to any audience.'),
  ('role_global_moderator',  'global_moderator',  'Global moderator',  'AI Trust & Safety designates.'),
  ('role_platform_admin',    'platform_admin',    'Platform admin',    'IM platform owners — configuration, quotas, role grants.'),
  ('role_break_glass_admin', 'break_glass_admin', 'Break-glass admin', 'Emergency local credential access. Heavily audited.');

-- ── Permission catalogue ─────────────────────────────────────────────────────
INSERT INTO "Permission" ("id", "key", "name") VALUES
  ('perm_post_draft',                'post.draft',                'Create a draft'),
  ('perm_post_publish',              'post.publish',              'Publish within quota'),
  ('perm_post_schedule',             'post.schedule',             'Schedule publication'),
  ('perm_post_target_beyond',        'post.target_beyond',        'Target audience beyond own scope'),
  ('perm_post_require_ack',          'post.require_ack',          'Mark post as requiring acknowledgement'),
  ('perm_post_approve',              'post.approve',              'Approve or reject queued posts'),
  ('perm_post_edit_any',             'post.edit_any',             'Edit any post in scope'),
  ('perm_post_archive',              'post.archive',              'Archive a post'),
  ('perm_comment_create',            'comment.create',            'Comment on a post'),
  ('perm_comment_delete_own',        'comment.delete_own',        'Delete own comment'),
  ('perm_moderation_hide',           'moderation.hide',           'Hide a post or comment'),
  ('perm_moderation_restore',        'moderation.restore',        'Restore hidden content'),
  ('perm_moderation_report_triage',  'moderation.report_triage',  'Triage reports'),
  ('perm_moderation_appeal_decide',  'moderation.appeal_decide',  'Decide appeals'),
  ('perm_moderation_restrict_user',  'moderation.restrict_user',  'Restrict a user''s posting rights'),
  ('perm_analytics_view_own',        'analytics.view_own',        'View own post analytics'),
  ('perm_analytics_view_entity',     'analytics.view_entity',     'View entity analytics'),
  ('perm_analytics_view_network',    'analytics.view_network',    'View network analytics'),
  ('perm_admin_grant_role',          'admin.grant_role',          'Grant and revoke platform roles'),
  ('perm_admin_configure',           'admin.configure',           'Configure quotas, topics, feature flags'),
  ('perm_admin_audit_view',          'admin.audit_view',          'View the audit log'),
  ('perm_admin_privacy_execute',     'admin.privacy_execute',     'Execute GDPR data subject requests');

-- ── Role → permission mapping ────────────────────────────────────────────────
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM (VALUES
  ('member',            'comment.create'),
  ('member',            'comment.delete_own'),

  ('entity_publisher',  'comment.create'),
  ('entity_publisher',  'comment.delete_own'),
  ('entity_publisher',  'post.draft'),
  ('entity_publisher',  'post.publish'),
  ('entity_publisher',  'post.schedule'),
  ('entity_publisher',  'analytics.view_own'),

  ('entity_editor',     'comment.create'),
  ('entity_editor',     'comment.delete_own'),
  ('entity_editor',     'post.draft'),
  ('entity_editor',     'post.publish'),
  ('entity_editor',     'post.schedule'),
  ('entity_editor',     'post.require_ack'),
  ('entity_editor',     'post.approve'),
  ('entity_editor',     'post.edit_any'),
  ('entity_editor',     'post.archive'),
  ('entity_editor',     'analytics.view_own'),
  ('entity_editor',     'analytics.view_entity'),

  ('entity_moderator',  'comment.create'),
  ('entity_moderator',  'comment.delete_own'),
  ('entity_moderator',  'moderation.hide'),
  ('entity_moderator',  'moderation.restore'),
  ('entity_moderator',  'moderation.report_triage'),
  ('entity_moderator',  'moderation.appeal_decide'),
  ('entity_moderator',  'admin.audit_view'),

  ('global_publisher',  'comment.create'),
  ('global_publisher',  'comment.delete_own'),
  ('global_publisher',  'post.draft'),
  ('global_publisher',  'post.publish'),
  ('global_publisher',  'post.schedule'),
  ('global_publisher',  'post.target_beyond'),
  ('global_publisher',  'post.require_ack'),
  ('global_publisher',  'analytics.view_own'),

  ('global_moderator',  'comment.create'),
  ('global_moderator',  'comment.delete_own'),
  ('global_moderator',  'post.approve'),
  ('global_moderator',  'moderation.hide'),
  ('global_moderator',  'moderation.restore'),
  ('global_moderator',  'moderation.report_triage'),
  ('global_moderator',  'moderation.appeal_decide'),
  ('global_moderator',  'moderation.restrict_user'),
  ('global_moderator',  'admin.audit_view')
) AS m(role_key, perm_key)
JOIN "Role" r ON r."key" = m.role_key
JOIN "Permission" p ON p."key" = m.perm_key;

-- platform_admin and break_glass_admin hold every permission.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."key" IN ('platform_admin', 'break_glass_admin');

-- ── Backfill grants from the retired binary UserRole enum ────────────────────
-- Every user gets `member` at GLOBAL scope, with no term label: membership is
-- not a position, and expiring it annually would sign the network out at
-- handover. `lib/rbac/grants.ts` writes the same shape, so the first login
-- updates this row rather than creating a second one.
INSERT INTO "RoleGrant" ("id", "userId", "roleId", "scopeType", "scopeEntityId", "termLabel", "source")
SELECT 'grant_mem_' || u."id", u."id", 'role_member', 'GLOBAL', NULL, NULL, 'GIS'
FROM "User" u;

-- Legacy MCPs become entity publishers *at their own entity*, so the grant is
-- scoped from the outset rather than network-wide.
--
-- The term label is computed rather than left NULL, and that matters twice over:
-- login-time reconciliation upserts on (user, role, scope, term), so a NULL here
-- would create a *second* grant at the first sign-in; and the stale-grant sweep
-- in `syncIdentityFromGis` only expires grants for the current term, so a
-- term-less grant would survive the holder losing their position — permanently.
--
-- AIESEC terms run July→June (lib/term.ts), so the label is derived from the
-- date this migration is applied.
INSERT INTO "RoleGrant" ("id", "userId", "roleId", "scopeType", "scopeEntityId", "termLabel", "source")
SELECT
    'grant_pub_' || u."id",
    u."id",
    'role_entity_publisher',
    'ENTITY',
    u."primaryEntityId",
    (
        SELECT to_char(start_year, 'FM00') || '.' || to_char(start_year + 1, 'FM00')
        FROM (
            SELECT (EXTRACT(YEAR FROM now())::int - CASE WHEN EXTRACT(MONTH FROM now()) >= 7 THEN 0 ELSE 1 END) % 100
                AS start_year
        ) t
    ),
    'GIS'
FROM "User" u
WHERE u."role" = 'MCP' AND u."primaryEntityId" IS NOT NULL;
