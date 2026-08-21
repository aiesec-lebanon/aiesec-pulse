import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isLockedFullAccess,
  PERMISSION_KEYS,
  permissionsForRole,
  PUBLISHING_TIERS,
  ROLE_KEYS,
  rolePermissionPairs,
} from "@/lib/rbac/catalogue";

// The catalogue lives in the module, in the migrations and in the seed. A role
// added to one and forgotten in another is silent, so this makes it a CI
// failure. Permissions are created across two migrations - M2 seeded the
// original catalogue and the position-classes migration amends it - so the
// permission assertions read both; roles and quotas are wholly redefined by the
// later one and read only that.

const sql = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const MIGRATION_SQL = sql("prisma/migrations/20260821090001_position_classes/migration.sql");

const CATALOGUE_SQL =
  sql("prisma/migrations/20260814090002_m2_rbac_catalogue/migration.sql") + MIGRATION_SQL;

describe("position classes", () => {
  it("recognises exactly the eight AIESEC titles", () => {
    expect([...ROLE_KEYS].sort()).toEqual(
      [
        "ai_manager",
        "ai_vp",
        "lc_president",
        "lc_vp",
        "mc_president",
        "mc_vp",
        "member",
        "pai",
      ].sort()
    );
  });

  it("no longer defines a role Pulse could confer but AIESEC could not revoke", () => {
    // architecture.md §6.2: a Pulse-owned role has no offboarding path at
    // handover, so every key must mirror a position AIESEC actually issues.
    for (const retired of [
      "entity_publisher",
      "entity_editor",
      "entity_moderator",
      "global_publisher",
      "global_moderator",
      "platform_admin",
      "break_glass_admin",
    ]) {
      expect(
        ROLE_KEYS as readonly string[],
        `'${retired}' is still in the catalogue`
      ).not.toContain(retired);
    }
  });

  it("defines every permission in the catalogue", () => {
    expect(PERMISSION_KEYS).toHaveLength(24);
    expect(PERMISSION_KEYS).toContain("post.promote");
    expect(PERMISSION_KEYS).toContain("post.demote");
    expect(PERMISSION_KEYS).toContain("admin.configure_roles");
  });

  it("retires admin.grant_role — grants come from GIS, not from Pulse", () => {
    expect(PERMISSION_KEYS as readonly string[]).not.toContain("admin.grant_role");
    expect(MIGRATION_SQL).toContain(`DELETE FROM "Permission" WHERE "key" = 'admin.grant_role'`);
  });

  it("seeds the same role keys as the position-classes migration", () => {
    for (const key of ROLE_KEYS) {
      expect(MIGRATION_SQL, `role '${key}' is missing from the migration`).toContain(`'${key}'`);
    }
  });

  it("seeds the same permission keys as the migrations", () => {
    for (const key of PERMISSION_KEYS) {
      expect(CATALOGUE_SQL, `permission '${key}' is created by no migration`).toContain(`'${key}'`);
    }
  });

  it("grants pai, ai_vp and ai_manager every permission", () => {
    for (const role of ["pai", "ai_vp", "ai_manager"] as const) {
      expect(permissionsForRole(role), `role ${role}`).toHaveLength(PERMISSION_KEYS.length);
    }
  });

  it("locks full access for pai and ai_vp only", () => {
    expect(isLockedFullAccess("pai")).toBe(true);
    expect(isLockedFullAccess("ai_vp")).toBe(true);
    // Global in reach, but an ordinary editable row — an AI Manager can be
    // scoped down without endangering the anti-lockout guarantee.
    expect(isLockedFullAccess("ai_manager")).toBe(false);
    expect(isLockedFullAccess("mc_president")).toBe(false);
  });
});

describe("default permission matrix — what each class must NOT hold", () => {
  const holds = (role: Parameters<typeof permissionsForRole>[0], permission: string) =>
    (permissionsForRole(role) as readonly string[]).includes(permission);

  it("a member cannot publish, approve, moderate or administer", () => {
    expect(holds("member", "post.publish")).toBe(false);
    expect(holds("member", "post.draft")).toBe(false);
    expect(holds("member", "post.approve")).toBe(false);
    expect(holds("member", "moderation.hide")).toBe(false);
    expect(holds("member", "admin.configure")).toBe(false);
    expect(holds("member", "admin.privacy_execute")).toBe(false);
  });

  it("an LCVP publishes but neither approves nor moderates", () => {
    expect(holds("lc_vp", "post.publish")).toBe(true);
    expect(holds("lc_vp", "post.approve")).toBe(false);
    expect(holds("lc_vp", "moderation.hide")).toBe(false);
    expect(holds("lc_vp", "analytics.view_entity")).toBe(false);
  });

  it("an MCVP approves and edits but does not moderate or restrict", () => {
    expect(holds("mc_vp", "post.approve")).toBe(true);
    expect(holds("mc_vp", "post.edit_any")).toBe(true);
    expect(holds("mc_vp", "moderation.hide")).toBe(false);
    expect(holds("mc_vp", "moderation.restrict_user")).toBe(false);
    expect(holds("mc_vp", "admin.audit_view")).toBe(false);
  });

  it("promotion is seeded to mc_president and above, and to nothing below", () => {
    // context.md §7.2: an MCP decides what their MC puts in front of the whole
    // network. Extending it to mc_vp is an admin's call, not a default.
    for (const permission of ["post.promote", "post.demote"]) {
      expect(holds("member", permission)).toBe(false);
      expect(holds("lc_vp", permission)).toBe(false);
      expect(holds("lc_president", permission)).toBe(false);
      expect(holds("mc_vp", permission)).toBe(false);
      expect(holds("mc_president", permission)).toBe(true);
      expect(holds("ai_manager", permission)).toBe(true);
      expect(holds("pai", permission)).toBe(true);
    }
  });

  it("only AI classes may target an audience beyond their own scope", () => {
    expect(holds("lc_president", "post.target_beyond")).toBe(false);
    expect(holds("mc_president", "post.target_beyond")).toBe(false);
    expect(holds("ai_manager", "post.target_beyond")).toBe(true);
  });

  it("only mc_president and above may restrict a user", () => {
    expect(holds("lc_president", "moderation.restrict_user")).toBe(false);
    expect(holds("mc_president", "moderation.restrict_user")).toBe(true);
  });

  it("erasure and matrix configuration are reachable only at AI level", () => {
    for (const role of ROLE_KEYS) {
      const isAiLevel = role === "pai" || role === "ai_vp" || role === "ai_manager";
      expect(holds(role, "admin.privacy_execute"), `role ${role}`).toBe(isAiLevel);
      expect(holds(role, "admin.configure_roles"), `role ${role}`).toBe(isAiLevel);
      expect(holds(role, "analytics.view_network"), `role ${role}`).toBe(isAiLevel);
    }
  });
});

describe("publishing tiers", () => {
  it("covers every class that may publish, most permissive first", () => {
    const publishers = ROLE_KEYS.filter((role) =>
      (permissionsForRole(role) as readonly string[]).includes("post.publish")
    );
    expect([...PUBLISHING_TIERS].sort()).toEqual([...publishers].sort());
    expect(PUBLISHING_TIERS[0]).toBe("pai");
    expect(PUBLISHING_TIERS[PUBLISHING_TIERS.length - 1]).toBe("lc_vp");
  });

  it("has a quota policy seeded for every tier", () => {
    for (const key of PUBLISHING_TIERS) {
      expect(MIGRATION_SQL, `no quota default for '${key}'`).toContain(`'quota_default_${key}'`);
    }
  });
});

describe("rolePermissionPairs", () => {
  it("produces no duplicates", () => {
    const pairs = rolePermissionPairs();
    const seen = new Set(pairs.map((p) => `${p.role}:${p.permission}`));
    expect(seen.size).toBe(pairs.length);
  });
});
