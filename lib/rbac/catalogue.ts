// Must stay in step with the RBAC migration and the seed; rbac-catalogue.test
// asserts all three agree. Pure constants with no imports, so client
// components can hide controls without pulling in the server runtime — hiding
// a control is never the check.

export const ROLE_KEYS = [
  "member",
  "entity_publisher",
  "entity_editor",
  "entity_moderator",
  "global_publisher",
  "global_moderator",
  "platform_admin",
  "break_glass_admin",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSION_KEYS = [
  "post.draft",
  "post.publish",
  "post.schedule",
  "post.target_beyond",
  "post.require_ack",
  "post.approve",
  "post.edit_any",
  "post.archive",
  "comment.create",
  "comment.delete_own",
  "moderation.hide",
  "moderation.restore",
  "moderation.report_triage",
  "moderation.appeal_decide",
  "moderation.restrict_user",
  "analytics.view_own",
  "analytics.view_entity",
  "analytics.view_network",
  "admin.grant_role",
  "admin.configure",
  "admin.audit_view",
  "admin.privacy_execute",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const ROLE_NAMES: Record<RoleKey, string> = {
  member: "Member",
  entity_publisher: "Entity publisher",
  entity_editor: "Entity editor",
  entity_moderator: "Entity moderator",
  global_publisher: "Global publisher",
  global_moderator: "Global moderator",
  platform_admin: "Platform admin",
  break_glass_admin: "Break-glass admin",
};

export const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  member: "Every authenticated AIESEC member.",
  entity_publisher: "MCP, MCVP, LCP and functional team leads — publishes for their entity.",
  entity_editor: "MC comms/IM team — edits and approves within their entity.",
  entity_moderator: "Nominated per MC — moderation only, within their entity.",
  global_publisher: "AI teams — publishes to any audience.",
  global_moderator: "AI Trust & Safety designates.",
  platform_admin: "IM platform owners — configuration, quotas, role grants.",
  break_glass_admin: "Emergency local credential access. Heavily audited.",
};

export const PERMISSION_NAMES: Record<PermissionKey, string> = {
  "post.draft": "Create a draft",
  "post.publish": "Publish within quota",
  "post.schedule": "Schedule publication",
  "post.target_beyond": "Target audience beyond own scope",
  "post.require_ack": "Mark post as requiring acknowledgement",
  "post.approve": "Approve or reject queued posts",
  "post.edit_any": "Edit any post in scope",
  "post.archive": "Archive a post",
  "comment.create": "Comment on a post",
  "comment.delete_own": "Delete own comment",
  "moderation.hide": "Hide a post or comment",
  "moderation.restore": "Restore hidden content",
  "moderation.report_triage": "Triage reports",
  "moderation.appeal_decide": "Decide appeals",
  "moderation.restrict_user": "Restrict a user's posting rights",
  "analytics.view_own": "View own post analytics",
  "analytics.view_entity": "View entity analytics",
  "analytics.view_network": "View network analytics",
  "admin.grant_role": "Grant and revoke platform roles",
  "admin.configure": "Configure quotas, topics, feature flags",
  "admin.audit_view": "View the audit log",
  "admin.privacy_execute": "Execute GDPR data subject requests",
};

// Expanded to the full set by permissionsForRole, so a new permission cannot
// be accidentally withheld from them.
const EXPLICIT_ROLE_PERMISSIONS: Record<
  Exclude<RoleKey, "platform_admin" | "break_glass_admin">,
  readonly PermissionKey[]
> = {
  member: ["comment.create", "comment.delete_own"],

  entity_publisher: [
    "comment.create",
    "comment.delete_own",
    "post.draft",
    "post.publish",
    "post.schedule",
    "analytics.view_own",
  ],

  entity_editor: [
    "comment.create",
    "comment.delete_own",
    "post.draft",
    "post.publish",
    "post.schedule",
    "post.require_ack",
    "post.approve",
    "post.edit_any",
    "post.archive",
    "analytics.view_own",
    "analytics.view_entity",
  ],

  entity_moderator: [
    "comment.create",
    "comment.delete_own",
    "moderation.hide",
    "moderation.restore",
    "moderation.report_triage",
    "moderation.appeal_decide",
    "admin.audit_view",
  ],

  global_publisher: [
    "comment.create",
    "comment.delete_own",
    "post.draft",
    "post.publish",
    "post.schedule",
    "post.target_beyond",
    "post.require_ack",
    "analytics.view_own",
  ],

  global_moderator: [
    "comment.create",
    "comment.delete_own",
    "post.approve",
    "moderation.hide",
    "moderation.restore",
    "moderation.report_triage",
    "moderation.appeal_decide",
    "moderation.restrict_user",
    "admin.audit_view",
  ],
};

export function permissionsForRole(role: RoleKey): readonly PermissionKey[] {
  if (role === "platform_admin" || role === "break_glass_admin") return PERMISSION_KEYS;
  return EXPLICIT_ROLE_PERMISSIONS[role];
}

export function rolePermissionPairs(): Array<{ role: RoleKey; permission: PermissionKey }> {
  return ROLE_KEYS.flatMap((role) =>
    permissionsForRole(role).map((permission) => ({ role, permission }))
  );
}

// Deriving these from a free-text GIS title would make trust & safety
// authority a function of someone renaming a role in EXPA.
export const MANUAL_ONLY_ROLES: readonly RoleKey[] = [
  "entity_editor",
  "entity_moderator",
  "global_moderator",
  "platform_admin",
  "break_glass_admin",
];

export function isManualOnly(role: RoleKey): boolean {
  return MANUAL_ONLY_ROLES.includes(role);
}
