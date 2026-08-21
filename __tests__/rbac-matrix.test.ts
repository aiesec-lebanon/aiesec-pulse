import { beforeEach, describe, expect, it, vi } from "vitest";

// Two things this file exists to hold down: what a class may do comes from the
// database and not from the seeded defaults, and no state of that database ever
// resolves to administering the platform.

vi.mock("@/lib/db", () => ({
  db: {
    role: { findMany: vi.fn(), findUnique: vi.fn() },
    permission: { findUnique: vi.fn() },
    rolePermission: { upsert: vi.fn(), deleteMany: vi.fn() },
    roleGrant: { findMany: vi.fn() },
    entity: { findUnique: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rbac/guards", () => ({ checkAdmin: vi.fn() }));

import { setRolePermission } from "@/app/actions/role-permissions";
import { db } from "@/lib/db";
import { can, permissionsOf } from "@/lib/rbac/can";
import { PERMISSION_KEYS, ROLE_KEYS, type RoleKey } from "@/lib/rbac/catalogue";
import { checkAdmin } from "@/lib/rbac/guards";
import { permissionMatrix } from "@/lib/rbac/matrix";
import { __clearLocalCache } from "@/lib/redis";

const roleFindMany = vi.mocked(db.role.findMany);
const roleFindUnique = vi.mocked(db.role.findUnique);
const permissionFindUnique = vi.mocked(db.permission.findUnique);
const grantFindMany = vi.mocked(db.roleGrant.findMany);
const upsert = vi.mocked(db.rolePermission.upsert);
const deleteMany = vi.mocked(db.rolePermission.deleteMany);
const auditCreate = vi.mocked(db.auditEvent.create);
const authorise = vi.mocked(checkAdmin);

/** One global grant of `role`, as `lib/rbac/can.ts` reads them. */
function holds(role: RoleKey) {
  grantFindMany.mockResolvedValue([
    { scopeType: "GLOBAL", role: { key: role }, scope: null },
  ] as never);
}

/** The `RolePermission` rows for one class, as `lib/rbac/matrix.ts` reads them. */
function matrixRows(rows: Record<string, string[]>) {
  roleFindMany.mockResolvedValue(
    Object.entries(rows).map(([key, permissions]) => ({
      key,
      permissions: permissions.map((permission) => ({ permission: { key: permission } })),
    })) as never
  );
}

const admin = { email: "admin@example.invalid" };

beforeEach(() => {
  vi.clearAllMocks();
  __clearLocalCache();
  authorise.mockResolvedValue({ ok: true, admin } as never);
  roleFindUnique.mockResolvedValue({ id: "role_x" } as never);
  permissionFindUnique.mockResolvedValue({ id: "perm_x" } as never);
});

describe("what a class may do comes from the database", () => {
  it("resolves an editable class from its rows, not from the seeded defaults", async () => {
    // The seed gives an MCVP nine permissions. The matrix here gives one, and
    // the matrix is what counts.
    holds("mc_vp");
    matrixRows({ mc_vp: ["post.publish"] });

    expect(await permissionsOf({ id: "u1" })).toEqual(new Set(["post.publish"]));
    expect(await can({ id: "u1" }, "post.approve")).toBe(false);
  });

  it("grants nothing to a class whose rows have all been withdrawn", async () => {
    holds("lc_vp");
    matrixRows({ lc_vp: [] });

    expect(await can({ id: "u2" }, "post.publish")).toBe(false);
  });

  it("holds no class at a fixed floor — every row is editable", async () => {
    for (const role of ["pai", "ai_vp", "ai_manager"] as const) {
      __clearLocalCache();
      holds(role);
      matrixRows({ [role]: [] });

      expect(await permissionsOf({ id: `u_${role}` }), role).toEqual(new Set());
      // Nothing short-circuits ahead of the lookup any more.
      expect(roleFindMany, role).toHaveBeenCalled();
    }
  });

  it("ignores a row naming a key outside the closed catalogue", async () => {
    holds("mc_vp");
    matrixRows({ mc_vp: ["post.publish", "post.teleport"], platform_admin: ["post.publish"] });

    const matrix = await permissionMatrix();
    expect(matrix.mc_vp).toEqual(["post.publish"]);
    expect(matrix).not.toHaveProperty("platform_admin");
  });
});

describe("no AIESEC position reaches platform administration", () => {
  it("resolves no administrative capability for any class, whatever its rows say", async () => {
    for (const role of ROLE_KEYS) {
      __clearLocalCache();
      holds(role);
      // Rows left behind by an older catalogue, offered back to the resolver.
      matrixRows({
        [role]: [
          ...PERMISSION_KEYS,
          "admin.configure_roles",
          "admin.configure",
          "admin.audit_view",
          "admin.privacy_execute",
          "analytics.view_network",
        ],
      });

      const resolved = await permissionsOf({ id: `u_${role}` });
      expect(
        [...resolved].filter((key) => key.startsWith("admin.")),
        role
      ).toEqual([]);
      expect(resolved.has("analytics.view_network"), role).toBe(false);
    }
  });

  it("offers no administrative permission to grant in the first place", () => {
    expect(PERMISSION_KEYS.filter((key) => key.startsWith("admin."))).toEqual([]);
  });
});

describe("setRolePermission", () => {
  it("withdraws a permission from a class and records it against the admin", async () => {
    const result = await setRolePermission("mc_vp", "post.approve", false);

    expect(result).toEqual({ ok: true });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { roleId: "role_x", permissionId: "perm_x" },
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "role.permission_revoked",
          actorType: "ADMIN",
          actorLabel: admin.email,
          targetType: "role",
          targetId: "mc_vp",
        }),
      })
    );
  });

  it("allows a permission a class did not have", async () => {
    const result = await setRolePermission("lc_vp", "post.approve", true);

    expect(result).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "role.permission_granted" }),
      })
    );
  });

  it("edits the AI classes like any other — nothing is locked", async () => {
    for (const role of ["pai", "ai_vp"] as const) {
      expect(await setRolePermission(role, "post.publish", false), role).toEqual({ ok: true });
    }
    expect(deleteMany).toHaveBeenCalledTimes(2);
  });

  it("refuses a key outside either closed list", async () => {
    expect(await setRolePermission("platform_admin", "post.publish", true)).toEqual({
      ok: false,
      error: "Unknown position class.",
    });
    expect(await setRolePermission("mc_vp", "admin.configure_roles", true)).toEqual({
      ok: false,
      error: "Unknown permission.",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses a caller without an admin session, however privileged their position", async () => {
    authorise.mockResolvedValue({
      ok: false,
      code: "unauthenticated",
      error: "Sign in to the admin console to continue.",
    } as never);

    expect(await setRolePermission("mc_vp", "post.approve", false)).toEqual({
      ok: false,
      error: "Sign in to the admin console to continue.",
    });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
