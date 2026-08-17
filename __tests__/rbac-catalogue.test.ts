import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isManualOnly,
  PERMISSION_KEYS,
  permissionsForRole,
  ROLE_KEYS,
  rolePermissionPairs,
} from "@/lib/rbac/catalogue";

// The catalogue lives in the module, the M2 migration and the seed. A role added
// to one and forgotten in another is silent, so this makes it a CI failure.

const MIGRATION_SQL = readFileSync(
  join(process.cwd(), "prisma/migrations/20260814090002_m2_rbac_catalogue/migration.sql"),
  "utf8"
);

describe("role and permission catalogue", () => {
  it("defines every role in the catalogue", () => {
    expect([...ROLE_KEYS].sort()).toEqual(
      [
        "break_glass_admin",
        "entity_editor",
        "entity_moderator",
        "entity_publisher",
        "global_moderator",
        "global_publisher",
        "member",
        "platform_admin",
      ].sort()
    );
  });

  it("defines every permission in the catalogue", () => {
    expect(PERMISSION_KEYS).toHaveLength(22);
    expect(PERMISSION_KEYS).toContain("admin.privacy_execute");
    expect(PERMISSION_KEYS).toContain("moderation.appeal_decide");
  });

  it("seeds the same role keys as the M2 migration", () => {
    for (const key of ROLE_KEYS) {
      expect(MIGRATION_SQL, `role '${key}' is missing from the M2 migration`).toContain(`'${key}'`);
    }
  });

  it("seeds the same permission keys as the M2 migration", () => {
    for (const key of PERMISSION_KEYS) {
      expect(MIGRATION_SQL, `permission '${key}' is missing from the M2 migration`).toContain(
        `'${key}'`
      );
    }
  });

  it("grants platform_admin and break_glass_admin every permission", () => {
    expect(permissionsForRole("platform_admin")).toHaveLength(PERMISSION_KEYS.length);
    expect(permissionsForRole("break_glass_admin")).toHaveLength(PERMISSION_KEYS.length);
  });
});

describe("permission matrix — what each role must NOT hold", () => {
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

  it("an entity publisher cannot approve its own queue or moderate", () => {
    expect(holds("entity_publisher", "post.approve")).toBe(false);
    expect(holds("entity_publisher", "moderation.hide")).toBe(false);
    expect(holds("entity_publisher", "post.target_beyond")).toBe(false);
    expect(holds("entity_publisher", "analytics.view_entity")).toBe(false);
  });

  it("an entity moderator cannot publish", () => {
    expect(holds("entity_moderator", "post.publish")).toBe(false);
    expect(holds("entity_moderator", "post.draft")).toBe(false);
    expect(holds("entity_moderator", "post.approve")).toBe(false);
  });

  it("only global roles and admins may target beyond their own scope", () => {
    expect(holds("entity_publisher", "post.target_beyond")).toBe(false);
    expect(holds("entity_editor", "post.target_beyond")).toBe(false);
    expect(holds("global_publisher", "post.target_beyond")).toBe(true);
    expect(holds("platform_admin", "post.target_beyond")).toBe(true);
  });

  it("only global moderators and admins may restrict a user", () => {
    expect(holds("entity_moderator", "moderation.restrict_user")).toBe(false);
    expect(holds("global_moderator", "moderation.restrict_user")).toBe(true);
  });

  it("erasure is reachable only through platform_admin", () => {
    for (const role of ROLE_KEYS) {
      const expected = role === "platform_admin" || role === "break_glass_admin";
      expect(holds(role, "admin.privacy_execute"), `role ${role}`).toBe(expected);
    }
  });

  it("network analytics is reachable only through platform_admin", () => {
    expect(holds("entity_editor", "analytics.view_network")).toBe(false);
    expect(holds("global_moderator", "analytics.view_network")).toBe(false);
    expect(holds("platform_admin", "analytics.view_network")).toBe(true);
  });
});

describe("manual-only roles", () => {
  it("treats publishing roles as GIS-derived, never hand-granted", () => {
    // Entity data comes from GIS; platform-only roles are granted
    // manually on top of it. Granting a publisher by hand would be reverted by
    // the next sync, so `grantRole` refuses it.
    expect(isManualOnly("entity_publisher")).toBe(false);
    expect(isManualOnly("global_publisher")).toBe(false);
    expect(isManualOnly("member")).toBe(false);
  });

  it("treats editor, moderator and admin roles as human appointments", () => {
    expect(isManualOnly("entity_editor")).toBe(true);
    expect(isManualOnly("entity_moderator")).toBe(true);
    expect(isManualOnly("global_moderator")).toBe(true);
    expect(isManualOnly("platform_admin")).toBe(true);
  });
});

describe("rolePermissionPairs", () => {
  it("produces no duplicates", () => {
    const pairs = rolePermissionPairs();
    const seen = new Set(pairs.map((p) => `${p.role}:${p.permission}`));
    expect(seen.size).toBe(pairs.length);
  });
});
