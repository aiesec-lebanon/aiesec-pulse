import { beforeEach, describe, expect, it, vi } from "vitest";

// The matrix is editable, so "nobody can administer the platform" is now a
// state someone could try to save. These are the tests that say they cannot.

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
vi.mock("@/lib/rbac/guards", () => ({ checkPermission: vi.fn() }));

import { setRolePermission } from "@/app/actions/role-permissions";
import { db } from "@/lib/db";
import { can, permissionsOf } from "@/lib/rbac/can";
import { PERMISSION_KEYS, type RoleKey } from "@/lib/rbac/catalogue";
import { checkPermission } from "@/lib/rbac/guards";
import { permissionMatrix } from "@/lib/rbac/matrix";
import { __clearLocalCache } from "@/lib/redis";

const roleFindMany = vi.mocked(db.role.findMany);
const roleFindUnique = vi.mocked(db.role.findUnique);
const permissionFindUnique = vi.mocked(db.permission.findUnique);
const grantFindMany = vi.mocked(db.roleGrant.findMany);
const upsert = vi.mocked(db.rolePermission.upsert);
const deleteMany = vi.mocked(db.rolePermission.deleteMany);
const auditCreate = vi.mocked(db.auditEvent.create);
const authorise = vi.mocked(checkPermission);

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

const admin = { id: "u_admin", fullName: "An Administrator" };

beforeEach(() => {
  vi.clearAllMocks();
  __clearLocalCache();
  authorise.mockResolvedValue({ ok: true, user: admin } as never);
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

  it("ignores a row naming a key outside the closed catalogue", async () => {
    holds("mc_vp");
    matrixRows({ mc_vp: ["post.publish", "post.teleport"], platform_admin: ["admin.configure"] });

    const matrix = await permissionMatrix();
    expect(matrix.mc_vp).toEqual(["post.publish"]);
    expect(matrix).not.toHaveProperty("platform_admin");
  });
});

describe("matrix edits cannot revoke pai or ai_vp access", () => {
  for (const locked of ["pai", "ai_vp"] as const) {
    it(`resolves every permission for ${locked} with its rows deleted`, async () => {
      holds(locked);
      matrixRows({ [locked]: [] });

      expect(await permissionsOf({ id: "u3" })).toEqual(new Set(PERMISSION_KEYS));
      // The floor is read off the position class ahead of the lookup, so a
      // matrix that cannot be read at all still cannot lock an admin out.
      expect(roleFindMany).not.toHaveBeenCalled();
    });

    it(`keeps ${locked} at full access in the matrix itself`, async () => {
      matrixRows({ [locked]: [] });
      expect((await permissionMatrix())[locked]).toEqual([...PERMISSION_KEYS]);
    });

    it(`refuses to withdraw a permission from ${locked}`, async () => {
      const result = await setRolePermission(locked, "admin.configure_roles", false);

      expect(result).toEqual({ ok: false, error: expect.stringContaining("cannot be edited") });
      expect(deleteMany).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    });
  }

  it("refuses a locked class before it looks the row up, so a missing row is no bypass", async () => {
    roleFindUnique.mockResolvedValue(null);
    const result = await setRolePermission("pai", "post.publish", false);

    expect(result.ok).toBe(false);
    expect(roleFindUnique).not.toHaveBeenCalled();
  });
});

describe("setRolePermission", () => {
  it("withdraws a permission from an editable class and records it", async () => {
    const result = await setRolePermission("mc_vp", "post.approve", false);

    expect(result).toEqual({ ok: true });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { roleId: "role_x", permissionId: "perm_x" },
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "role.permission_revoked",
          targetType: "role",
          targetId: "mc_vp",
        }),
      })
    );
  });

  it("allows a permission an editable class did not have", async () => {
    const result = await setRolePermission("lc_vp", "post.approve", true);

    expect(result).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "role.permission_granted" }),
      })
    );
  });

  it("refuses a key outside either closed list", async () => {
    expect(await setRolePermission("platform_admin", "post.publish", true)).toEqual({
      ok: false,
      error: "Unknown position class.",
    });
    expect(await setRolePermission("mc_vp", "post.teleport", true)).toEqual({
      ok: false,
      error: "Unknown permission.",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses a caller who does not hold admin.configure_roles", async () => {
    authorise.mockResolvedValue({
      ok: false,
      code: "forbidden",
      error: "You do not have permission to do that.",
    } as never);

    expect(await setRolePermission("mc_vp", "post.approve", false)).toEqual({
      ok: false,
      error: "You do not have permission to do that.",
    });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
