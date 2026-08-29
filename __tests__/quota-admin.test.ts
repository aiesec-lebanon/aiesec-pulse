import { describe, expect, it } from "vitest";

import { PostLevel } from "@/app/generated/prisma/enums";
import { rolesSpendingAt, SPENDING_PERMISSION } from "@/lib/quota";
import { MAX_BUDGET, parseBudget } from "@/lib/quota-shared";
import type { PermissionKey, RoleKey } from "@/lib/rbac/catalogue";
import { ROLE_KEYS, seededPermissionsFor } from "@/lib/rbac/catalogue";

function seededMatrix(): Record<RoleKey, readonly PermissionKey[]> {
  return Object.fromEntries(ROLE_KEYS.map((role) => [role, seededPermissionsFor(role)])) as Record<
    RoleKey,
    readonly PermissionKey[]
  >;
}

describe("rolesSpendingAt", () => {
  it("asks for the permission that actually spends the budget", () => {
    expect(SPENDING_PERMISSION[PostLevel.LOCAL]).toBe("post.publish");
    expect(SPENDING_PERMISSION[PostLevel.NETWORK]).toBe("post.promote");
  });

  it("lists the publishing classes and leaves out a plain member", () => {
    const roles = rolesSpendingAt(PostLevel.LOCAL, seededMatrix());
    expect(roles).toContain("lc_vp");
    expect(roles).toContain("mc_president");
    expect(roles).not.toContain("member");
  });

  it("lists only the promoting classes for the network budget", () => {
    const roles = rolesSpendingAt(PostLevel.NETWORK, seededMatrix());
    // Promotion is the MCP's editorial call; the tiers beneath it publish
    // locally and never spend a promotion.
    expect(roles).toContain("mc_president");
    expect(roles).not.toContain("mc_vp");
    expect(roles).not.toContain("lc_president");
  });

  it("follows the live matrix rather than the seeded defaults", () => {
    // The matrix is editable — withdrawing post.promote must also remove
    // the budget row, or an admin ends up allowing spend nobody can make.
    const matrix = seededMatrix();
    const withoutPromotion = {
      ...matrix,
      mc_president: matrix.mc_president.filter((p) => p !== "post.promote"),
    };
    expect(rolesSpendingAt(PostLevel.NETWORK, withoutPromotion)).not.toContain("mc_president");
  });
});

describe("parseBudget", () => {
  it("accepts a whole number inside the ceiling, zero included", () => {
    // Zero is a real budget: it stops a class publishing without withdrawing
    // the permission, which is a different statement.
    expect(parseBudget(0)).toBe(0);
    expect(parseBudget("3")).toBe(3);
    expect(parseBudget(MAX_BUDGET)).toBe(MAX_BUDGET);
  });

  it("refuses anything a budget cannot be", () => {
    expect(parseBudget(-1)).toBeNull();
    expect(parseBudget(1.5)).toBeNull();
    expect(parseBudget(MAX_BUDGET + 1)).toBeNull();
    expect(parseBudget("")).toBeNull();
    expect(parseBudget("many")).toBeNull();
    expect(parseBudget(null)).toBeNull();
  });
});
