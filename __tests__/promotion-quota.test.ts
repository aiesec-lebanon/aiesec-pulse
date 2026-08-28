import { describe, expect, it } from "vitest";

import { promotionCountWhere, promotionPoolFor } from "@/lib/quota";

// The promotion budget has two rules easy to state and easy to undo by
// accident: it's spent per MC, not per officer, and it stays spent when a
// post is demoted. Both live in a where clause, so both are asserted
// against the clause itself, not through a database round trip.

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
    // A prefix without the trailing separator would pull /ai/mena/lbx into
    // another MC's budget.
    expect(where.promotedById).toBeUndefined();
  });

  it("counts only the promoter when there is no MC to pool across", () => {
    const where = promotionCountWhere(promotionPoolFor("user_pai", null), WEEK, POST);
    expect(where.promotedById).toBe("user_pai");
    expect(where.promotedBy).toBeUndefined();
  });

  it("does not filter on level, so demotion refunds nothing", () => {
    // Counting `AND level = NETWORK` would hand the promotion back the moment
    // the post was demoted and make promote/demote cycling an unbounded reach
    // budget. The spend is permanent for the window.
    const where = promotionCountWhere(promotionPoolFor("user_mcp", MC), WEEK, POST);
    expect(where).not.toHaveProperty("level");
    expect(where.promotionPeriod).toBe(WEEK);
  });

  it("excludes the post being promoted from its own budget", () => {
    // Re-promoting something this window already paid for is free; a second
    // post is not. Without this, a post could be demoted and then refused
    // re-promotion on the strength of its own spend.
    const where = promotionCountWhere(promotionPoolFor("user_mcp", MC), WEEK, POST);
    expect(where.id).toEqual({ not: POST });
  });

  it("counts the whole spend when no post is excluded", () => {
    // What a budget label asks. Excluding a post there would have two posts in
    // one MC reporting different remaining budgets for the same pool.
    const where = promotionCountWhere(promotionPoolFor("user_mcp", MC), WEEK);
    expect(where.id).toBeUndefined();
  });
});
