import { describe, expect, it } from "vitest";

import { promotionCountWhere, promotionPoolFor } from "@/lib/quota";

// Promotion budget rules: spent per MC (not per officer), and stays spent
// after demotion. Asserted directly against the where clause, not via DB.

const MC = { path: "/ai/mena/lb" };
const WEEK = "2026-W34";
const POST = "post_being_promoted";

describe("promotionPoolFor", () => {
  it("bills an officer's promotion to their MC, not to them", () => {
    // An MC cannot buy extra network reach by spreading
    // promotions across several MCVPs.
    expect(promotionPoolFor("user_mcp", MC)).toEqual({ mcPath: MC.path });
  });

  it("bills a promoter above the MC tier to themselves", () => {
    // The same rule, not an exception to it: an AI-level officer shares an MC
    // with nobody, so the pool is just them.
    expect(promotionPoolFor("user_pai", null)).toEqual({ promoterId: "user_pai" });
  });
});

describe("promotionCountWhere", () => {
  it("counts every officer whose entity sits in the MC subtree", () => {
    const where = promotionCountWhere(promotionPoolFor("user_mcp", MC), WEEK, POST);
    expect(where.promotedBy).toEqual({
      primaryEntity: {
        OR: [{ path: "/ai/mena/lb" }, { path: { startsWith: "/ai/mena/lb/" } }],
      },
    });
    // Without the trailing separator, the prefix would pull /ai/mena/lbx
    // into another MC's budget.
    expect(where.promotedById).toBeUndefined();
  });

  it("counts only the promoter when there is no MC to pool across", () => {
    const where = promotionCountWhere(promotionPoolFor("user_pai", null), WEEK, POST);
    expect(where.promotedById).toBe("user_pai");
    expect(where.promotedBy).toBeUndefined();
  });

  it("does not filter on level, so demotion refunds nothing", () => {
    // Filtering on level would refund the spend on demotion, making
    // promote/demote cycling an unbounded reach budget.
    const where = promotionCountWhere(promotionPoolFor("user_mcp", MC), WEEK, POST);
    expect(where).not.toHaveProperty("level");
    expect(where.promotionPeriod).toBe(WEEK);
  });

  it("excludes the post being promoted from its own budget", () => {
    // Excludes the post's own prior spend so demote-then-repromote isn't
    // blocked by budget it already paid for.
    const where = promotionCountWhere(promotionPoolFor("user_mcp", MC), WEEK, POST);
    expect(where.id).toEqual({ not: POST });
  });

  it("counts the whole spend when no post is excluded", () => {
    // A remaining-budget label needs the full spend — excluding a post here
    // would show two posts in one MC different numbers for the same pool.
    const where = promotionCountWhere(promotionPoolFor("user_mcp", MC), WEEK);
    expect(where.id).toBeUndefined();
  });
});
