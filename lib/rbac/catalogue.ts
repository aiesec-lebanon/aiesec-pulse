// Roles are AIESEC position classes, not Pulse inventions: AIESEC's identity
// system has no way for an application to confer or revoke a role of its own,
// so a Pulse-defined role would have no offboarding story at handover
// (architecture.md §6.2). The list is closed and code-defined — new titles are
// added here deliberately, never inferred from live data.
//
// Must stay in step with the M16 migration and the seed; rbac-catalogue.test
// asserts all three agree. Pure constants with no imports, so client
// components can hide controls without pulling in the server runtime — hiding
// a control is never the check.

export const ROLE_KEYS = [
  "pai",
  "ai_vp",
  "ai_manager",
  "mc_president",
  "mc_vp",
  "lc_president",
  "lc_vp",
  "member",
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
  "post.promote",
  "post.demote",
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
  "admin.configure_roles",
  "admin.configure",
  "admin.audit_view",
  "admin.privacy_execute",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const ROLE_NAMES: Record<RoleKey, string> = {
  pai: "PAI",
  ai_vp: "AIVP",
  ai_manager: "AI Manager",
  mc_president: "MCP",
  mc_vp: "MCVP",
  lc_president: "LCP",
  lc_vp: "LCVP",
  member: "Member",
};

export const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  pai: "President of AIESEC International. Full access, locked in code.",
  ai_vp: "Vice President of AIESEC International. Full access, locked in code.",
  ai_manager: "AIESEC International manager — global reach, fully configurable.",
  mc_president: "Member Committee President — own MC and every LC beneath it. Promotes posts.",
  mc_vp: "Member Committee Vice President — own MC and every LC beneath it.",
  lc_president: "Local Committee President — own LC.",
  lc_vp: "Local Committee Vice President — own LC.",
  member: "Every AIESEC member. Read and engage.",
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
  "post.promote": "Promote a post to network level",
  "post.demote": "Return a promoted post to local level",
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
  "admin.configure_roles": "Edit the role → permission matrix",
  "admin.configure": "Configure quotas, topics, feature flags",
  "admin.audit_view": "View the audit log",
  "admin.privacy_execute": "Execute GDPR data subject requests",
};

// `pai` and `ai_vp` hold every permission unconditionally — a fixed floor in
// code, not editable rows, so no matrix state can leave the platform with
// nobody able to administer it (architecture.md §7.1). `lib/rbac/can.ts`
// enforces the same floor ahead of the database lookup; these constants only
// describe it for the seed and for read-only UI.
export type LockedRoleKey = "pai" | "ai_vp";

export const LOCKED_FULL_ACCESS_ROLES: readonly LockedRoleKey[] = ["pai", "ai_vp"];

export function isLockedFullAccess(role: RoleKey): role is LockedRoleKey {
  return (LOCKED_FULL_ACCESS_ROLES as readonly RoleKey[]).includes(role);
}

// Publishing tiers, most permissive first. A member holding several positions
// is billed against the widest one, so the precedence has to be explicit rather
// than "whichever grant the database returned first". `member` is absent
// because a member does not publish.
export const PUBLISHING_TIERS: readonly RoleKey[] = [
  "pai",
  "ai_vp",
  "ai_manager",
  "mc_president",
  "mc_vp",
  "lc_president",
  "lc_vp",
];

/** The narrowest publishing allowance — the safe default when no tier matches. */
export const NARROWEST_PUBLISHING_TIER: RoleKey = "lc_vp";

// Seed data, and only seed data. The live answer to "what may this class do"
// is the `RolePermission` table, read by `lib/rbac/matrix.ts` and re-assignable
// at runtime by an AI-level admin (`admin.configure_roles`). What follows is
// the starting point that table is seeded with and the state a reset returns
// it to — never consult it to authorise anything.
const DEFAULT_ROLE_PERMISSIONS: Record<
  Exclude<RoleKey, "pai" | "ai_vp" | "ai_manager">,
  readonly PermissionKey[]
> = {
  member: ["comment.create", "comment.delete_own"],

  lc_vp: [
    "comment.create",
    "comment.delete_own",
    "post.draft",
    "post.publish",
    "post.schedule",
    "analytics.view_own",
  ],

  // An LCP moderates their own LC: with no MC officer beneath them, the
  // nearest moderator to a local report is the LCP.
  lc_president: [
    "comment.create",
    "comment.delete_own",
    "post.draft",
    "post.publish",
    "post.schedule",
    "post.require_ack",
    "post.approve",
    "post.edit_any",
    "post.archive",
    "moderation.hide",
    "moderation.restore",
    "moderation.report_triage",
    "moderation.appeal_decide",
    "analytics.view_own",
    "analytics.view_entity",
    "admin.audit_view",
  ],

  mc_vp: [
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

  // Promotion is seeded here and nowhere below: deciding what an MC puts in
  // front of the whole network is the MCP's editorial call (context.md §7.2).
  mc_president: [
    "comment.create",
    "comment.delete_own",
    "post.draft",
    "post.publish",
    "post.schedule",
    "post.require_ack",
    "post.approve",
    "post.edit_any",
    "post.archive",
    "post.promote",
    "post.demote",
    "moderation.hide",
    "moderation.restore",
    "moderation.report_triage",
    "moderation.appeal_decide",
    "moderation.restrict_user",
    "analytics.view_own",
    "analytics.view_entity",
    "admin.audit_view",
  ],
};

// `ai_manager` starts at full access like the two locked classes, but is an
// ordinary editable row — an AI Manager can be scoped down without touching
// the lockout guarantee.
export function seededPermissionsFor(role: RoleKey): readonly PermissionKey[] {
  if (isLockedFullAccess(role) || role === "ai_manager") return PERMISSION_KEYS;
  return DEFAULT_ROLE_PERMISSIONS[role];
}

export function rolePermissionPairs(): Array<{ role: RoleKey; permission: PermissionKey }> {
  return ROLE_KEYS.flatMap((role) =>
    seededPermissionsFor(role).map((permission) => ({ role, permission }))
  );
}
