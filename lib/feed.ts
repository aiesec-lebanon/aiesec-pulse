import "server-only";

import type { FollowState } from "@/app/actions/follows";
import type { Prisma } from "@/app/generated/prisma/client";
import { FollowTarget, PostStatus } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { type ScopeSet, scopeSetFor, visibilityFilter } from "@/lib/org/scope";
import { requireSession } from "@/lib/rbac/guards";
import { cached, cacheKeys } from "@/lib/redis";
import type { FeedPost } from "@/types/feed";

// Scope filtering lives in the query, not in application code, so a missing
// guard cannot leak rows through this path.

const POSTS_PER_PAGE = 7; // 1 hero + 3 sidebar + 3 secondary

const feedSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  bodyText: true,
  readingMinutes: true,
  publishedAt: true,
  createdAt: true,
  reactionCount: true,
  commentCount: true,
  cover: { select: { path: true, altText: true, bucket: true } },
  author: {
    select: { id: true, fullName: true, avatarUrl: true },
  },
  publisher: { select: { id: true, name: true, tag: true } },
  topics: { select: { topic: { select: { slug: true, name: true } } } },
} as const;

type FeedRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  bodyText: string;
  readingMinutes: number;
  publishedAt: Date | null;
  createdAt: Date;
  reactionCount: number;
  commentCount: number;
  cover: { path: string; altText: string | null; bucket: string } | null;
  author: { id: string; fullName: string; avatarUrl: string | null };
  publisher: { id: string; name: string; tag: string | null };
  topics: Array<{ topic: { slug: string; name: string } }>;
};

// SUPABASE_URL is the S3 endpoint used for uploads; public objects are served
// from a different host and path, so concatenating onto it 404s every image.
// SUPABASE_PUBLIC_URL overrides the derivation for a custom domain.
export function publicStorageBase(): string | null {
  const explicit = process.env.SUPABASE_PUBLIC_URL?.replace(/\/+$/, "");
  if (explicit) return `${explicit}/storage/v1/object/public`;

  const configured = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  if (!configured) return null;

  const projectOrigin = configured
    .replace(/\/storage\/v1\/s3$/, "")
    .replace(/\.storage\.supabase\.co$/, ".supabase.co");

  return `${projectOrigin}/storage/v1/object/public`;
}

// A row whose key could not be parsed during the M6 backfill still holds a
// full URL, and is returned untouched.
export function mediaUrl(cover: { bucket: string; path: string } | null): string | null {
  if (!cover) return null;
  if (/^https?:\/\//.test(cover.path)) return cover.path;

  const base = publicStorageBase();
  if (!base) return null;
  return `${base}/${cover.bucket}/${cover.path}`;
}

export function toFeedPost(row: FeedRow, entityFollowStates: Map<string, FollowState>): FeedPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.summary ?? row.bodyText.slice(0, 200),
    readingMinutes: row.readingMinutes,
    mediaUrl: mediaUrl(row.cover),
    mediaAlt: row.cover?.altText ?? null,
    author: {
      id: row.author.id,
      fullName: row.author.fullName,
      avatarUrl: row.author.avatarUrl,
      entityName: row.publisher.name,
    },
    publisherEntityId: row.publisher.id,
    entityFollowState: entityFollowStates.get(row.publisher.id) ?? "none",
    reactionCount: row.reactionCount,
    commentCount: row.commentCount,
    publishedAt: row.publishedAt ?? row.createdAt,
    topics: row.topics.map((t) => t.topic),
  };
}

// Shared by getFeedPage and getTopicFeed so "what counts as visible" can
// never drift between the main feed and a topic archive. Both conditions are
// nested under AND because each is an OR in its own right — spreading the
// second over the first would silently drop the expiry check.
function visiblePublishedWhere(scope: ScopeSet): Prisma.PostWhereInput {
  const now = new Date();
  return {
    status: PostStatus.PUBLISHED,
    publishedAt: { lte: now },
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, visibilityFilter(scope)],
  };
}

async function followStatesFor(
  userId: string,
  targetType: FollowTarget,
  targetIds: string[]
): Promise<Map<string, FollowState>> {
  if (targetIds.length === 0) return new Map();

  const follows = await db.follow.findMany({
    where: { userId, targetType, targetId: { in: targetIds } },
    select: { targetId: true, muted: true },
  });
  return new Map(follows.map((f) => [f.targetId, f.muted ? "muted" : "following"]));
}

// One extra indexed query (Follow's own @@unique([userId, targetType,
// targetId]) covers this lookup) per feed page, batched across every
// distinct publisher entity shown rather than resolved per card.
function entityFollowStatesFor(
  userId: string,
  entityIds: string[]
): Promise<Map<string, FollowState>> {
  return followStatesFor(userId, FollowTarget.ENTITY, entityIds);
}

// Same shape, for the ranking affinity term (M12) below.
function topicFollowStatesFor(
  userId: string,
  topicIds: string[]
): Promise<Map<string, FollowState>> {
  return followStatesFor(userId, FollowTarget.TOPIC, topicIds);
}

export async function getFeedPage(page: number): Promise<{ posts: FeedPost[]; hasNext: boolean }> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);

  const rows = await db.post.findMany({
    where: visiblePublishedWhere(scope),
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * POSTS_PER_PAGE,
    take: POSTS_PER_PAGE + 1,
    select: feedSelect,
  });
  const page1 = rows.slice(0, POSTS_PER_PAGE);
  const entityFollowStates = await entityFollowStatesFor(user.id, [
    ...new Set(page1.map((r) => r.publisher.id)),
  ]);

  return {
    posts: page1.map((r) => toFeedPost(r, entityFollowStates)),
    hasNext: rows.length > POSTS_PER_PAGE,
  };
}

const TOPIC_PAGE_SIZE = 12;

// Same audience-scoping as the main feed — a topic archive is never a way
// around targeting (context.md §8.3: audience is a distribution control the
// reader-facing surfaces must all honour identically).
export async function getTopicFeed(
  topicId: string,
  page: number
): Promise<{ posts: FeedPost[]; hasNext: boolean }> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);

  const rows = await db.post.findMany({
    where: { ...visiblePublishedWhere(scope), topics: { some: { topicId } } },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * TOPIC_PAGE_SIZE,
    take: TOPIC_PAGE_SIZE + 1,
    select: feedSelect,
  });
  const page1 = rows.slice(0, TOPIC_PAGE_SIZE);
  const entityFollowStates = await entityFollowStatesFor(user.id, [
    ...new Set(page1.map((r) => r.publisher.id)),
  ]);

  return {
    posts: page1.map((r) => toFeedPost(r, entityFollowStates)),
    hasNext: rows.length > TOPIC_PAGE_SIZE,
  };
}

const BOOKMARKS_PAGE_SIZE = 12;

// Ordered by when the viewer bookmarked the post, not when it was published
// — starting the query from Bookmark rather than Post is what gives that
// ordering for free. visiblePublishedWhere on the nested post relation drops
// a bookmark whose post has since been unpublished or fallen outside the
// viewer's audience, same "never a way around targeting" rule getTopicFeed
// already follows.
export async function getBookmarkedPosts(
  page: number
): Promise<{ posts: FeedPost[]; hasNext: boolean }> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);

  const rows = await db.bookmark.findMany({
    where: { userId: user.id, post: visiblePublishedWhere(scope) },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * BOOKMARKS_PAGE_SIZE,
    take: BOOKMARKS_PAGE_SIZE + 1,
    select: { post: { select: feedSelect } },
  });
  const page1 = rows.slice(0, BOOKMARKS_PAGE_SIZE);
  const entityFollowStates = await entityFollowStatesFor(user.id, [
    ...new Set(page1.map((r) => r.post.publisher.id)),
  ]);

  return {
    posts: page1.map((r) => toFeedPost(r.post, entityFollowStates)),
    hasNext: rows.length > BOOKMARKS_PAGE_SIZE,
  };
}

const RELATED_POSTS_LIMIT = 4;

// Story 20: shared-topic posts first, then same-publisher-entity, excluding
// self — no new query infrastructure, just visiblePublishedWhere (the same
// "never a way around targeting" rule getTopicFeed/getBookmarkedPosts
// already follow) sliced two ways and merged.
export async function getRelatedPosts(
  excludePostId: string,
  publisherEntityId: string,
  topicIds: string[]
): Promise<FeedPost[]> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);
  const where = visiblePublishedWhere(scope);

  const byTopic =
    topicIds.length > 0
      ? await db.post.findMany({
          where: {
            ...where,
            id: { not: excludePostId },
            topics: { some: { topicId: { in: topicIds } } },
          },
          orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
          take: RELATED_POSTS_LIMIT,
          select: feedSelect,
        })
      : [];

  const remaining = RELATED_POSTS_LIMIT - byTopic.length;
  const byEntity =
    remaining > 0
      ? await db.post.findMany({
          where: {
            ...where,
            id: { notIn: [excludePostId, ...byTopic.map((p) => p.id)] },
            publisherEntityId,
          },
          orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
          take: remaining,
          select: feedSelect,
        })
      : [];

  const rows = [...byTopic, ...byEntity];
  const entityFollowStates = await entityFollowStatesFor(user.id, [
    ...new Set(rows.map((r) => r.publisher.id)),
  ]);

  return rows.map((r) => toFeedPost(r, entityFollowStates));
}

// ---------------------------------------------------------------------------
// Ranking (story 16, M12) — architecture.md §11. Deterministic and weighted,
// no learned model; every term below is inspectable per-post via
// getPostRankingBreakdown, which backs the "why this appeared" disclosure.
//
// Deliberate reading of §11's "computation happens in SQL over a bounded
// candidate set": the *bounding* — visiblePublishedWhere + ORDER BY + LIMIT
// 500, so this never scans the full archive — is SQL, in rankingCandidatesFor
// below. The score arithmetic itself runs in JS over that already-bounded set
// (≤500 rows of plain numbers), the same call M10 made choosing EXISTS/CROSS
// JOIN over the doc's illustrated SQL: it keeps the formula a plain,
// unit-testable function — this repo's established pattern for business
// logic (dueScheduledPostsQuery, decideAudienceForSubmission both work the
// same way) — and it's what lets a single post's breakdown share the exact
// code path that ranked the feed, rather than a second, raw-SQL formula that
// could silently drift from it.
//
// Caching: §17 keys the feed candidate cache by "scope set", but the formula
// itself defines affinity (Follow) and seen (PostRead) as per-viewer terms —
// two members of the same entity can have different follows and read
// history, so flattening those into a shared cache entry would silently
// undo the personalisation story 16 asks for. Resolved by caching only the
// scope-shared half (which posts are candidates, and every term that only
// depends on the entity tree — see cacheKeys.feedRanked) and layering the
// two genuinely personal terms on top at request time, cheaply, since they're
// bounded lookups against the already-cached candidate ids.
// ---------------------------------------------------------------------------

export type RankingWeights = {
  recency: number;
  proximity: number;
  affinity: number;
  signal: number;
  priority: number;
  seen: number;
  halfLifeHours: number;
  normaliser: number;
};

const RANKING_WEIGHT_DEFAULTS: RankingWeights = {
  recency: 1.0,
  proximity: 0.6,
  affinity: 0.4,
  signal: 0.3,
  priority: 0.8,
  seen: 0.5,
  halfLifeHours: 36,
  normaliser: 50,
};

// A missing or unreadable row falls back to the seeded default rather than
// zeroing the term out — a DB hiccup should degrade ranking quality, not
// silently flatten a term to nothing.
async function loadRankingWeights(): Promise<RankingWeights> {
  const rows = await db.rankingWeight.findMany({ select: { key: true, weight: true } });
  const byKey = new Map(rows.map((r) => [r.key, r.weight]));

  const weights = { ...RANKING_WEIGHT_DEFAULTS };
  for (const key of Object.keys(weights) as Array<keyof RankingWeights>) {
    const found = byKey.get(key);
    if (typeof found === "number") weights[key] = found;
  }
  return weights;
}

export type ProximityTier = "same-entity" | "same-mc" | "same-region" | "global";

const PROXIMITY_BY_TIER: Record<ProximityTier, number> = {
  "same-entity": 1.0,
  "same-mc": 0.8,
  "same-region": 0.5,
  global: 0.3,
};

/**
 * architecture.md §11: "same LC = 1.0, same MC = 0.8, same region = 0.5,
 * global = 0.3" — read as tiers of shared ancestry between the viewer's own
 * entity and the post's publisher entity (Entity.path, e.g.
 * "/ai/mena/lb/aub"), not a literal equality check: a post published by the
 * viewer's own MC (an ancestor of the viewer's LC, not the same node) is
 * "same MC", not "global". A viewer with no primary entity has no home base
 * to be close to anything, so every post lands at the global floor.
 */
export function proximityTier(viewerPath: string | null, publisherPath: string): ProximityTier {
  if (!viewerPath) return "global";
  if (viewerPath === publisherPath) return "same-entity";

  const viewerParts = viewerPath.split("/").filter(Boolean);
  const publisherParts = publisherPath.split("/").filter(Boolean);

  let common = 0;
  while (
    common < viewerParts.length &&
    common < publisherParts.length &&
    viewerParts[common] === publisherParts[common]
  ) {
    common++;
  }

  if (common >= 3) return "same-mc";
  if (common >= 2) return "same-region";
  return "global";
}

/**
 * Every DB lookup already resolved, so the formula itself stays a pure
 * function of primitives — unit-testable with hand-built fixtures, no
 * database, no mocking.
 */
export type RankingCandidateInput = {
  publishedAt: Date;
  publisherEntityPath: string;
  topicFollowStates: FollowState[];
  entityFollowState: FollowState;
  reactionCount: number;
  commentCount: number;
  pinned: boolean;
  needsAck: boolean;
  alreadyRead: boolean;
};

export type RankingTerms = {
  recency: { value: number; weighted: number };
  proximity: { value: number; weighted: number; tier: ProximityTier };
  affinity: { value: number; weighted: number; followedCount: number; mutedCount: number };
  signal: { value: number; weighted: number };
  priority: { value: number; weighted: number; pinned: boolean; needsAck: boolean };
  seen: { value: number; weighted: number; alreadyRead: boolean };
};

export type ScoredPost = { score: number; terms: RankingTerms };

/**
 * architecture.md §11's formula, verbatim. `terms[*].weighted` always sums to
 * `score` (seen's `weighted` is pre-negated) — that invariant is what makes
 * the per-post breakdown (getPostRankingBreakdown) a projection of the exact
 * numbers that ranked the feed, not a second computation that could drift
 * from it.
 */
export function scorePost(
  candidate: RankingCandidateInput,
  viewerEntityPath: string | null,
  weights: RankingWeights,
  now: Date = new Date()
): ScoredPost {
  const hoursSince = Math.max(0, (now.getTime() - candidate.publishedAt.getTime()) / 3_600_000);
  const recencyValue = Math.exp(-hoursSince / weights.halfLifeHours);
  const recencyWeighted = weights.recency * recencyValue;

  const tier = proximityTier(viewerEntityPath, candidate.publisherEntityPath);
  const proximityValue = PROXIMITY_BY_TIER[tier];
  const proximityWeighted = weights.proximity * proximityValue;

  const followedCount =
    candidate.topicFollowStates.filter((s) => s === "following").length +
    (candidate.entityFollowState === "following" ? 1 : 0);
  const mutedCount =
    candidate.topicFollowStates.filter((s) => s === "muted").length +
    (candidate.entityFollowState === "muted" ? 1 : 0);
  const affinityValue = followedCount - mutedCount;
  const affinityWeighted = weights.affinity * affinityValue;

  const signalValue =
    Math.log1p(candidate.reactionCount + 2 * candidate.commentCount) /
    Math.log1p(weights.normaliser);
  const signalWeighted = weights.signal * signalValue;

  const priorityValue = (candidate.pinned ? 1 : 0) + (candidate.needsAck ? 1 : 0);
  const priorityWeighted = weights.priority * priorityValue;

  const seenValue = candidate.alreadyRead ? 1 : 0;
  const seenWeighted = weights.seen * seenValue;

  const score =
    recencyWeighted +
    proximityWeighted +
    affinityWeighted +
    signalWeighted +
    priorityWeighted -
    seenWeighted;

  return {
    score,
    terms: {
      recency: { value: recencyValue, weighted: recencyWeighted },
      proximity: { value: proximityValue, weighted: proximityWeighted, tier },
      affinity: { value: affinityValue, weighted: affinityWeighted, followedCount, mutedCount },
      signal: { value: signalValue, weighted: signalWeighted },
      priority: {
        value: priorityValue,
        weighted: priorityWeighted,
        pinned: candidate.pinned,
        needsAck: candidate.needsAck,
      },
      // 0 - seenWeighted, not unary negation: negating a zero seenWeighted
      // would produce -0, which is arithmetically harmless but an odd value
      // to hand back to a caller (e.g. Object.is-based test assertions).
      seen: { value: seenValue, weighted: 0 - seenWeighted, alreadyRead: candidate.alreadyRead },
    },
  };
}

const RANKING_CANDIDATE_WINDOW = 500;

const rankingSelect = {
  id: true,
  publishedAt: true,
  createdAt: true,
  publisherEntityId: true,
  publisher: { select: { path: true } },
  topics: { select: { topicId: true } },
  reactionCount: true,
  commentCount: true,
  pinnedUntil: true,
  requiresAck: true,
} as const;

type RankingRow = {
  id: string;
  publishedAt: Date | null;
  createdAt: Date;
  publisherEntityId: string;
  publisher: { path: string };
  topics: Array<{ topicId: string }>;
  reactionCount: number;
  commentCount: number;
  pinnedUntil: Date | null;
  requiresAck: boolean;
};

// Redis round-trips everything through JSON, so Dates would come back as
// strings on a cache hit while staying Date instances on a miss (or under
// the process-local fallback) — a divergence that would only surface once
// Redis is actually configured. Converting explicitly at both ends keeps the
// shape identical regardless of which backing store served it.
type CachedRankingRow = Omit<RankingRow, "publishedAt" | "createdAt" | "pinnedUntil"> & {
  publishedAt: string | null;
  createdAt: string;
  pinnedUntil: string | null;
};

/**
 * The expensive, shared half of ranking: cached per scope set, per
 * architecture.md §11/§17 (see cacheKeys.feedRanked for why that's sound
 * even though affinity/seen are personal). Personal terms are layered on by
 * the caller — never cached here.
 */
async function rankingCandidatesFor(scope: ScopeSet): Promise<RankingRow[]> {
  const key = cacheKeys.feedRanked(scope.primaryEntityId ?? "none");

  const rows = await cached<CachedRankingRow[]>(key, 60, async () => {
    const fresh = await db.post.findMany({
      where: visiblePublishedWhere(scope),
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: RANKING_CANDIDATE_WINDOW,
      select: rankingSelect,
    });
    return fresh.map((r) => ({
      ...r,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      pinnedUntil: r.pinnedUntil?.toISOString() ?? null,
    }));
  });

  return rows.map((r) => ({
    ...r,
    publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
    createdAt: new Date(r.createdAt),
    pinnedUntil: r.pinnedUntil ? new Date(r.pinnedUntil) : null,
  }));
}

async function readPostIdsFor(userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const rows = await db.postRead.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });
  return new Set(rows.map((r) => r.postId));
}

async function acknowledgedPostIdsFor(userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const rows = await db.acknowledgement.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });
  return new Set(rows.map((r) => r.postId));
}

function toRankingCandidateInput(
  row: RankingRow,
  ctx: {
    topicFollowStates: Map<string, FollowState>;
    entityFollowState: FollowState;
    alreadyRead: boolean;
    acknowledged: boolean;
  },
  now: Date
): RankingCandidateInput {
  return {
    publishedAt: row.publishedAt ?? row.createdAt,
    publisherEntityPath: row.publisher.path,
    topicFollowStates: row.topics.map((t) => ctx.topicFollowStates.get(t.topicId) ?? "none"),
    entityFollowState: ctx.entityFollowState,
    reactionCount: row.reactionCount,
    commentCount: row.commentCount,
    pinned: row.pinnedUntil !== null && row.pinnedUntil > now,
    needsAck: row.requiresAck && !ctx.acknowledged,
    alreadyRead: ctx.alreadyRead,
  };
}

export async function getForYouFeedPage(
  page: number
): Promise<{ posts: FeedPost[]; hasNext: boolean }> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);

  const candidates = await rankingCandidatesFor(scope);
  if (candidates.length === 0) return { posts: [], hasNext: false };

  const allTopicIds = [...new Set(candidates.flatMap((c) => c.topics.map((t) => t.topicId)))];
  const publisherEntityIds = [...new Set(candidates.map((c) => c.publisherEntityId))];
  const candidateIds = candidates.map((c) => c.id);
  const ackRequiredIds = candidates.filter((c) => c.requiresAck).map((c) => c.id);

  const [weights, topicFollowStates, entityFollowStates, readIds, ackIds] = await Promise.all([
    loadRankingWeights(),
    topicFollowStatesFor(user.id, allTopicIds),
    entityFollowStatesFor(user.id, publisherEntityIds),
    readPostIdsFor(user.id, candidateIds),
    acknowledgedPostIdsFor(user.id, ackRequiredIds),
  ]);

  const now = new Date();
  const scored = candidates
    .map((c) => {
      const input = toRankingCandidateInput(
        c,
        {
          topicFollowStates,
          entityFollowState: entityFollowStates.get(c.publisherEntityId) ?? "none",
          alreadyRead: readIds.has(c.id),
          acknowledged: ackIds.has(c.id),
        },
        now
      );
      const { score } = scorePost(input, scope.primaryEntityPath, weights, now);
      return { id: c.id, score, publishedAt: input.publishedAt };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.publishedAt.getTime() !== a.publishedAt.getTime()) {
        return b.publishedAt.getTime() - a.publishedAt.getTime();
      }
      return a.id < b.id ? 1 : -1;
    });

  const start = (page - 1) * POSTS_PER_PAGE;
  const pageIds = scored.slice(start, start + POSTS_PER_PAGE).map((s) => s.id);
  const hasNext = scored.length > start + POSTS_PER_PAGE;
  if (pageIds.length === 0) return { posts: [], hasNext: false };

  // Re-filtered by visibility, not just id: the candidate window can be up
  // to 60s stale (rankingCandidatesFor's cache TTL), and a post hidden by
  // moderation in that window must not still render.
  const rows = await db.post.findMany({
    where: { id: { in: pageIds }, ...visiblePublishedWhere(scope) },
    select: feedSelect,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const orderedRows = pageIds
    .map((id) => byId.get(id))
    .filter((r): r is FeedRow => r !== undefined);

  return {
    posts: orderedRows.map((r) => toFeedPost(r, entityFollowStates)),
    hasNext,
  };
}

/**
 * The single-post equivalent of getForYouFeedPage's scoring, for the "why
 * this appeared" disclosure (post detail, For You mode only). Independent of
 * the cached candidate window — a linked post outside the top 500 still gets
 * an accurate breakdown — but shares scorePost, so the numbers shown can
 * never drift from what actually ranked the feed.
 */
export async function getPostRankingBreakdown(postId: string): Promise<ScoredPost | null> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);

  const post = await db.post.findFirst({
    where: { id: postId, ...visiblePublishedWhere(scope) },
    select: rankingSelect,
  });
  if (!post) return null;

  const topicIds = post.topics.map((t) => t.topicId);
  const [weights, topicFollowStates, entityFollowStates, readIds, ackIds] = await Promise.all([
    loadRankingWeights(),
    topicFollowStatesFor(user.id, topicIds),
    entityFollowStatesFor(user.id, [post.publisherEntityId]),
    readPostIdsFor(user.id, [post.id]),
    acknowledgedPostIdsFor(user.id, post.requiresAck ? [post.id] : []),
  ]);

  const now = new Date();
  const input = toRankingCandidateInput(
    post,
    {
      topicFollowStates,
      entityFollowState: entityFollowStates.get(post.publisherEntityId) ?? "none",
      alreadyRead: readIds.has(post.id),
      acknowledged: ackIds.has(post.id),
    },
    now
  );

  return scorePost(input, scope.primaryEntityPath, weights, now);
}

export type TrendingAuthor = {
  id: string;
  fullName: string;
  entityName: string | null;
  postCount: number;
};

export async function getTrendingAuthors(): Promise<TrendingAuthor[]> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const visible = await db.post.findMany({
    where: {
      status: PostStatus.PUBLISHED,
      publishedAt: { gte: since },
      ...visibilityFilter(scope),
    },
    select: { authorId: true },
  });

  const counts = new Map<string, number>();
  for (const row of visible) counts.set(row.authorId, (counts.get(row.authorId) ?? 0) + 1);
  if (counts.size === 0) return [];

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const authors = await db.user.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, fullName: true, primaryEntity: { select: { name: true } } },
  });

  return top
    .map(([id, postCount]) => {
      const author = authors.find((a) => a.id === id);
      return author
        ? {
            id,
            fullName: author.fullName,
            entityName: author.primaryEntity?.name ?? null,
            postCount,
          }
        : null;
    })
    .filter((a): a is TrendingAuthor => a !== null);
}

export const FEED_PAGE_SIZE = POSTS_PER_PAGE;
