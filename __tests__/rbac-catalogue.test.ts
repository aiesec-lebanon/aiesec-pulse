import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PERMISSION_KEYS,
  PUBLISHING_TIERS,
  ROLE_KEYS,
  rolePermissionPairs,
  seededPermissionsFor,
} from "@/lib/rbac/catalogue";

// The catalogue lives in the module, in the migrations and in the seed. A role
// added to one and forgotten in another is silent, so this makes it a CI
// failure. Permissions are created across two migrations - the first seeded the
// original catalogue and the position-classes migration amends it - so the
// permission assertions read both; roles and quotas are wholly redefined by the
// later one and read only that.

const sql = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const MIGRATION_SQL = sql("prisma/migrations/20260821090001_position_classes/migration.sql");

const ADMIN_SPLIT_SQL = sql(
  "prisma/migrations/20260821120002_administration_off_positions/migration.sql"
);

const POST_LEVEL_SQL = sql("prisma/migrations/20260822090001_m19_post_level/migration.sql");

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
    // A Pulse-owned role has no offboarding path at handover, so every key
    // must mirror a position AIESEC actually issues.
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
    expect(PERMISSION_KEYS).toHaveLength(19);
    expect(PERMISSION_KEYS).toContain("post.promote");
    expect(PERMISSION_KEYS).toContain("post.demote");
  });

  it("retires admin.grant_role — grants come from GIS, not from Pulse", () => {
    expect(PERMISSION_KEYS as readonly string[]).not.toContain("admin.grant_role");
    expect(MIGRATION_SQL).toContain(`DELETE FROM "Permission" WHERE "key" = 'admin.grant_role'`);
  });

  it("carries no administration capability at all", () => {
    // Administering the platform is a separate credential login, so there is
    // no permission for an AIESEC position to hold and no matrix state that
    // could confer one.
    for (const retired of [
      "admin.configure_roles",
      "admin.configure",
      "admin.audit_view",
      "admin.privacy_execute",
      "analytics.view_network",
    ]) {
      expect(
        PERMISSION_KEYS as readonly string[],
        `'${retired}' is still a permission`
      ).not.toContain(retired);
      expect(ADMIN_SPLIT_SQL, `'${retired}' is not deleted by the migration`).toContain(
        `'${retired}'`
      );
    }
    expect(PERMISSION_KEYS.filter((key) => key.startsWith("admin."))).toEqual([]);
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

  it("seeds pai, ai_vp and ai_manager the whole remaining catalogue", () => {
    for (const role of ["pai", "ai_vp", "ai_manager"] as const) {
      expect(seededPermissionsFor(role), `role ${role}`).toHaveLength(PERMISSION_KEYS.length);
    }
  });
});

describe("default permission matrix — what each class must NOT hold", () => {
  const holds = (role: Parameters<typeof seededPermissionsFor>[0], permission: string) =>
    (seededPermissionsFor(role) as readonly string[]).includes(permission);

  it("a member cannot publish, approve or moderate", () => {
    expect(holds("member", "post.publish")).toBe(false);
    expect(holds("member", "post.draft")).toBe(false);
    expect(holds("member", "post.approve")).toBe(false);
    expect(holds("member", "moderation.hide")).toBe(false);
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
  });

  it("promotion is seeded to mc_president and above, and to nothing below", () => {
    // An MCP decides what their MC puts in front of the whole network.
    // Extending it to mc_vp is an admin's call, not a default.
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

  it("no class holds an administration capability, because none exists", () => {
    for (const role of ROLE_KEYS) {
      const administrative = seededPermissionsFor(role).filter((key) => key.startsWith("admin."));
      expect(administrative, `role ${role}`).toEqual([]);
    }
  });
});

describe("publishing tiers", () => {
  it("covers every class that may publish, most permissive first", () => {
    const publishers = ROLE_KEYS.filter((role) =>
      (seededPermissionsFor(role) as readonly string[]).includes("post.publish")
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

describe("promotion quota", () => {
  it("seeds a NETWORK budget for every class that may promote", () => {
    // Holding `post.promote` with no NETWORK policy behind it is a class that
    // can reach the control and never use it — resolveQuotaPolicy returns null
    // and the action refuses. The two have to be seeded together.
    const promoters = ROLE_KEYS.filter((role) =>
      (seededPermissionsFor(role) as readonly string[]).includes("post.promote")
    );
    expect(promoters.length).toBeGreaterThan(0);

    for (const key of promoters) {
      expect(POST_LEVEL_SQL, `no NETWORK quota for '${key}'`).toContain(`'quota_network_${key}'`);
    }
  });

  it("gives no promotion budget to a class that cannot promote", () => {
    for (const key of ROLE_KEYS) {
      if ((seededPermissionsFor(key) as readonly string[]).includes("post.promote")) continue;
      expect(POST_LEVEL_SQL, `'${key}' has a NETWORK quota it can never spend`).not.toContain(
        `'quota_network_${key}'`
      );
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
