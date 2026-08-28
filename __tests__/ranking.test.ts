import { describe, expect, it } from "vitest";

import {
  proximityTier,
  type RankingCandidateInput,
  type RankingWeights,
  scorePost,
} from "@/lib/feed";

const NOW = new Date("2026-08-19T12:00:00Z");

const WEIGHTS: RankingWeights = {
  recency: 1.0,
  proximity: 0.6,
  affinity: 0.4,
  signal: 0.3,
  priority: 0.8,
  seen: 0.5,
  halfLifeHours: 36,
  normaliser: 50,
};

const VIEWER_PATH = "/ai/mena/lb/aub";

function candidate(overrides: Partial<RankingCandidateInput> = {}): RankingCandidateInput {
  return {
    publishedAt: NOW,
    publisherEntityPath: VIEWER_PATH,
    topicFollowStates: [],
    entityFollowState: "none",
    reactionCount: 0,
    commentCount: 0,
    pinned: false,
    needsAck: false,
    alreadyRead: false,
    ...overrides,
  };
}

describe("proximityTier", () => {
  it("floors at global when the viewer has no primary entity", () => {
    expect(proximityTier(null, "/ai/mena/lb")).toBe("global");
  });

  it("is same-entity for an identical path", () => {
    expect(proximityTier(VIEWER_PATH, VIEWER_PATH)).toBe("same-entity");
  });

  it("is same-mc when the publisher is the viewer's own MC (an ancestor, not an equal path)", () => {
    expect(proximityTier(VIEWER_PATH, "/ai/mena/lb")).toBe("same-mc");
  });

  it("is same-mc for a sibling LC under the same MC", () => {
    expect(proximityTier(VIEWER_PATH, "/ai/mena/lb/other-lc")).toBe("same-mc");
  });

  it("is same-region for a different MC in the same region", () => {
    expect(proximityTier(VIEWER_PATH, "/ai/mena/eg")).toBe("same-region");
  });

  it("is global for a different region entirely", () => {
    expect(proximityTier(VIEWER_PATH, "/ai/emea/de")).toBe("global");
  });
});

describe("scorePost — recency", () => {
  it("ranks a newer post above an otherwise-identical older one", () => {
    const newer = scorePost(candidate({ publishedAt: NOW }), VIEWER_PATH, WEIGHTS, NOW);
    const older = scorePost(
      candidate({ publishedAt: new Date(NOW.getTime() - 48 * 3_600_000) }),
      VIEWER_PATH,
      WEIGHTS,
      NOW
    );
    expect(newer.score).toBeGreaterThan(older.score);
  });

  it("decays to 1/e at exactly one half-life", () => {
    const oneHalfLifeAgo = new Date(NOW.getTime() - WEIGHTS.halfLifeHours * 3_600_000);
    const { terms } = scorePost(
      candidate({ publishedAt: oneHalfLifeAgo }),
      VIEWER_PATH,
      WEIGHTS,
      NOW
    );
    expect(terms.recency.value).toBeCloseTo(Math.exp(-1), 10);
  });

  it("clamps to no decay for a post published fractionally in the future (clock skew)", () => {
    const future = new Date(NOW.getTime() + 5_000);
    const { terms } = scorePost(candidate({ publishedAt: future }), VIEWER_PATH, WEIGHTS, NOW);
    expect(terms.recency.value).toBe(1);
  });
});

describe("scorePost — proximity", () => {
  it("orders same-entity > same-mc > same-region > global when every other term is equal", () => {
    const scoreAt = (publisherEntityPath: string) =>
      scorePost(candidate({ publisherEntityPath }), VIEWER_PATH, WEIGHTS, NOW).score;

    const sameEntity = scoreAt(VIEWER_PATH);
    const sameMc = scoreAt("/ai/mena/lb");
    const sameRegion = scoreAt("/ai/mena/eg");
    const global = scoreAt("/ai/emea/de");

    expect(sameEntity).toBeGreaterThan(sameMc);
    expect(sameMc).toBeGreaterThan(sameRegion);
    expect(sameRegion).toBeGreaterThan(global);
  });
});

describe("scorePost — affinity", () => {
  it("adds one per followed topic/entity and subtracts one per muted", () => {
    const followed = scorePost(
      candidate({ topicFollowStates: ["following", "following"], entityFollowState: "following" }),
      null,
      WEIGHTS,
      NOW
    );
    const muted = scorePost(candidate({ topicFollowStates: ["muted"] }), null, WEIGHTS, NOW);
    const neutral = scorePost(candidate({}), null, WEIGHTS, NOW);

    expect(followed.terms.affinity.value).toBe(3);
    expect(muted.terms.affinity.value).toBe(-1);
    expect(neutral.terms.affinity.value).toBe(0);
  });
});

describe("scorePost — signal", () => {
  it("weights comments 2x reactions and normalises by weights.normaliser", () => {
    const { terms } = scorePost(
      candidate({ reactionCount: 10, commentCount: 5 }),
      null,
      WEIGHTS,
      NOW
    );
    expect(terms.signal.value).toBeCloseTo(
      Math.log1p(10 + 2 * 5) / Math.log1p(WEIGHTS.normaliser),
      10
    );
  });

  it("is zero with no engagement at all", () => {
    const { terms } = scorePost(candidate({}), null, WEIGHTS, NOW);
    expect(terms.signal.value).toBe(0);
  });
});

describe("scorePost — priority", () => {
  it("adds one for pinned and one for an unacknowledged requires-ack post", () => {
    const both = scorePost(candidate({ pinned: true, needsAck: true }), null, WEIGHTS, NOW);
    const neither = scorePost(candidate({}), null, WEIGHTS, NOW);

    expect(both.terms.priority.value).toBe(2);
    expect(neither.terms.priority.value).toBe(0);
  });
});

describe("scorePost — seen", () => {
  it("penalises an already-read post rather than merely zeroing its contribution", () => {
    const read = scorePost(candidate({ alreadyRead: true }), null, WEIGHTS, NOW);
    const unread = scorePost(candidate({ alreadyRead: false }), null, WEIGHTS, NOW);

    expect(read.score).toBeLessThan(unread.score);
    expect(read.terms.seen.weighted).toBeCloseTo(-WEIGHTS.seen, 10);
    expect(unread.terms.seen.weighted).toBe(0);
  });
});

describe("scorePost — score is a projection of its own terms", () => {
  it("score always equals the sum of every term's weighted contribution", () => {
    const { score, terms } = scorePost(
      candidate({
        reactionCount: 10,
        commentCount: 4,
        pinned: true,
        needsAck: true,
        alreadyRead: true,
        topicFollowStates: ["following", "muted"],
        entityFollowState: "following",
        publisherEntityPath: "/ai/emea/de",
      }),
      VIEWER_PATH,
      WEIGHTS,
      NOW
    );

    const sum =
      terms.recency.weighted +
      terms.proximity.weighted +
      terms.affinity.weighted +
      terms.signal.weighted +
      terms.priority.weighted +
      terms.seen.weighted;

    expect(score).toBeCloseTo(sum, 10);
  });
});

describe("scorePost — a RankingWeight change reorders results predictably", () => {
  it("affinity outweighing proximity once the affinity weight is raised", () => {
    const closeButUnfollowed = candidate({
      publisherEntityPath: VIEWER_PATH,
      topicFollowStates: [],
    });
    const farButFollowed = candidate({
      publisherEntityPath: "/ai/emea/de",
      topicFollowStates: ["following"],
    });

    const withDefaultWeights = {
      close: scorePost(closeButUnfollowed, VIEWER_PATH, WEIGHTS, NOW).score,
      far: scorePost(farButFollowed, VIEWER_PATH, WEIGHTS, NOW).score,
    };
    expect(withDefaultWeights.close).toBeGreaterThan(withDefaultWeights.far);

    const affinityHeavyWeights: RankingWeights = { ...WEIGHTS, affinity: 2.0 };
    const withAffinityHeavyWeights = {
      close: scorePost(closeButUnfollowed, VIEWER_PATH, affinityHeavyWeights, NOW).score,
      far: scorePost(farButFollowed, VIEWER_PATH, affinityHeavyWeights, NOW).score,
    };
    expect(withAffinityHeavyWeights.far).toBeGreaterThan(withAffinityHeavyWeights.close);
  });
});
