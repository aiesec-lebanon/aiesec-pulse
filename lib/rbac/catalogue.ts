// Roles are AIESEC position classes, not Pulse inventions — a Pulse-only
// role would have no offboarding story at handover, so the list is closed
// and code-defined, never inferred from live data. Must stay in sync with
// the migration and seed (rbac-catalogue.test asserts it). No imports, so
// client components can hide controls without pulling in the server
// runtime — hiding a control is never the check.

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
  pai: "President of AIESEC International — global editorial reach.",
  ai_vp: "Vice President of AIESEC International — global editorial reach.",
  ai_manager: "AIESEC International manager — global editorial reach.",
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
};

// Most permissive first — a member holding several positions is billed
// against the widest one, so precedence must be explicit, not DB order.
// `member` is absent because members don't publish.
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

/**
 * AI-level offices sit above the MC tier and have no MC, so `LOCAL` means
 * nothing — their posts are born `NETWORK`. Keyed on this class list, not
 * "no MC ancestor": an unsynced leaf office also has no MC temporarily,
 * and class-keying avoids mistaking that gap for network-wide reach.
 */
export const AI_LEVEL_ROLES = ["pai", "ai_vp", "ai_manager"] as const;

export type AiLevelRole = (typeof AI_LEVEL_ROLES)[number];

export function isAiLevelRole(role: RoleKey): role is AiLevelRole {
  return (AI_LEVEL_ROLES as readonly RoleKey[]).includes(role);
}

// Seed data only — the live answer is the `RolePermission` table (see
// lib/rbac/matrix.ts), re-assignable at runtime. Never consult this to authorise anything.
const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<RoleKey, AiLevelRole>, readonly PermissionKey[]> = {
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
  // front of the whole network is the MCP's editorial call.
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
  ],
};

// AI classes start with the whole catalogue but are ordinary editable rows
// like any other — nothing is locked, since platform admin is no longer
// reachable from any AIESEC position.
export function seededPermissionsFor(role: RoleKey): readonly PermissionKey[] {
  if (isAiLevelRole(role)) return PERMISSION_KEYS;
  return DEFAULT_ROLE_PERMISSIONS[role];
}

export function rolePermissionPairs(): Array<{ role: RoleKey; permission: PermissionKey }> {
  return ROLE_KEYS.flatMap((role) =>
    seededPermissionsFor(role).map((permission) => ({ role, permission }))
  );
}
