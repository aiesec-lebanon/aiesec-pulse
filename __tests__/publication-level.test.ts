import { describe, expect, it } from "vitest";

import { PostLevel, PostStatus } from "@/app/generated/prisma/enums";
import { decideReach, type ReachContext } from "@/lib/content/level";
import type { ResolvedQuota } from "@/lib/quota";

const POLICY: ResolvedQuota = {
  policyId: "quota_network_mc_president",
  roleKey: "mc_president",
  postLevel: PostLevel.NETWORK,
  period: "ISO_WEEK",
  maxPosts: 1,
  periodLabel: "2026-W34",
};

const txSpending = (used: number) =>
  ({ post: { count: async () => used } }) as unknown as Parameters<typeof decideReach>[0];

const MC_PROMOTER: ReachContext = {
  defaultLevel: PostLevel.LOCAL,
  promotion: { pool: { mcPath: "/ai/mena/lb" }, policy: POLICY },
};

const NO_PROMOTER: ReachContext = { defaultLevel: PostLevel.LOCAL, promotion: null };

const AI_OFFICE: ReachContext = { defaultLevel: PostLevel.NETWORK, promotion: null };

const asked = { promoteToNetwork: true, note: "Worth the whole network's attention." };
const notAsked = { promoteToNetwork: false, note: undefined };

describe("an AI-level office", () => {
  it("publishes at network level without spending a promotion", () => {
    // AI-level posts default to NETWORK by position — no promoter, note,
    // or window stamp on the row.
    return expect(
      decideReach(txSpending(0), AI_OFFICE, "user_pai", PostStatus.PUBLISHED, notAsked)
    ).resolves.toEqual({ ok: true, level: PostLevel.NETWORK, stamp: null });
  });

  it("still spends nothing when the composer asks to promote", async () => {
    // Nothing to raise, so a stray request cannot charge a budget for reach the
    // post already has.
    const decision = await decideReach(
      txSpending(0),
      AI_OFFICE,
      "user_pai",
      PostStatus.PUBLISHED,
      asked
    );
    expect(decision).toEqual({ ok: true, level: PostLevel.NETWORK, stamp: null });
  });
});

describe("an MC publisher", () => {
  it("publishes locally when the network is not asked for", async () => {
    // An MC's own posts start LOCAL like everyone else's — that's what makes
    // the promotion quota a real cap on network-feed volume.
    const decision = await decideReach(
      txSpending(0),
      MC_PROMOTER,
      "user_mcp",
      PostStatus.PUBLISHED,
      notAsked
    );
    expect(decision).toEqual({ ok: true, level: PostLevel.LOCAL, stamp: null });
  });

  it("spends a promotion when it asks for the network", async () => {
    const decision = await decideReach(
      txSpending(0),
      MC_PROMOTER,
      "user_mcp",
      PostStatus.PUBLISHED,
      asked
    );
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.level).toBe(PostLevel.NETWORK);
    expect(decision.stamp).toMatchObject({
      promotedById: "user_mcp",
      promotionNote: asked.note,
      promotionPeriod: "2026-W34",
    });
  });

  it("keeps the choice on a scheduled post", async () => {
    // The scheduler only flips status; it never re-touches quota. The window is
    // spent at submit time, the same call publishing already makes.
    const decision = await decideReach(
      txSpending(0),
      MC_PROMOTER,
      "user_mcp",
      PostStatus.SCHEDULED,
      asked
    );
    expect(decision.ok).toBe(true);
  });

  it("refuses to promote a post that is going to the approval queue", async () => {
    // A queued post reaches nobody, so spending a window on it would burn the
    // budget on reach that does not exist yet.
    const decision = await decideReach(
      txSpending(0),
      MC_PROMOTER,
      "user_mcp",
      PostStatus.IN_REVIEW,
      asked
    );
    expect(decision).toMatchObject({ ok: false, field: "_form" });
  });

  it("refuses without a stated reason", async () => {
    const decision = await decideReach(txSpending(0), MC_PROMOTER, "user_mcp", "PUBLISHED", {
      promoteToNetwork: true,
      note: "  hi ",
    });
    expect(decision).toMatchObject({ ok: false, field: "promotionNote" });
  });

  it("stops hard once the window is spent", async () => {
    const decision = await decideReach(
      txSpending(1),
      MC_PROMOTER,
      "user_mcp",
      PostStatus.PUBLISHED,
      asked
    );
    expect(decision).toMatchObject({ ok: false, field: "_form" });
  });
});

describe("a publisher who cannot promote", () => {
  it("is refused rather than quietly published locally", async () => {
    // Silently downgrading would tell the author their post reached the network
    // when it did not.
    const decision = await decideReach(
      txSpending(0),
      NO_PROMOTER,
      "user_lcvp",
      PostStatus.PUBLISHED,
      asked
    );
    expect(decision).toMatchObject({ ok: false, field: "_form" });
  });
});
