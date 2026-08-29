import "server-only";

import type { FollowState } from "@/app/actions/follows";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  type EntityKind,
  FollowTarget,
  type PostLevel,
  PostStatus,
  type TopicKind,
} from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { entityDisplayName } from "@/lib/org/display";
import { type ScopeSet, scopeSetFor, visibilityFilter } from "@/lib/org/scope";
import { requireSession } from "@/lib/rbac/guards";
import { cached, cacheKeys } from "@/lib/redis";
import type { FeedPost } from "@/types/feed";

// Scope filtering lives in the query, not in application code, so a missing
// guard cannot leak rows through this path.

const POSTS_PER_PAGE = 8; // 1 hero + 4 "also today" (rotating) + 3 "elsewhere"

const feedSelect = {
  id: true,
  slug: true,
  title: true,
  titleAccent: true,
  summary: true,
  bodyText: true,
  readingMinutes: true,
  level: true,
  publishedAt: true,
  createdAt: true,
  reactionCount: true,
  commentCount: true,
  cover: { select: { path: true, altText: true, bucket: true } },
  author: {
    select: { id: true, fullName: true, avatarUrl: true },
  },
  publisher: { select: { id: true, name: true, tag: true, kind: true } },
  topics: { select: { topic: { select: { slug: true, name: true, kind: true } } } },
} as const;

type FeedRow = {
  id: string;
  slug: string;
  title: string;
  titleAccent: string | null;
  summary: string | null;
  bodyText: string;
  readingMinutes: number;
  level: PostLevel;
  publishedAt: Date | null;
  createdAt: Date;
  reactionCount: number;
  commentCount: number;
  cover: { path: string; altText: string | null; bucket: string } | null;
  author: { id: string; fullName: string; avatarUrl: string | null };
  publisher: { id: string; name: string; tag: string | null; kind: EntityKind };
  topics: Array<{ topic: { slug: string; name: string; kind: TopicKind } }>;
};

// SUPABASE_URL is the S3 endpoint for uploads; public objects live on a
// different host/path, so concatenating onto it 404s every image.
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

// A row whose key could not be parsed during the backfill still holds a
// full URL, and is returned untouched.
export function mediaUrl(cover: { bucket: string; path: string } | null): string | null {
  if (!cover) return null;
  if (/^https?:\/\//.test(cover.path)) return cover.path;

  const base = publicStorageBase();
  if (!base) return null;
  return `${base}/${cover.bucket}/${cover.path}`;
}

function toFeedPost(row: FeedRow, entityFollowStates: Map<string, FollowState>): FeedPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleAccent: row.titleAccent,
    excerpt: row.summary ?? row.bodyText.slice(0, 200),
    readingMinutes: row.readingMinutes,
    level: row.level,
    mediaUrl: mediaUrl(row.cover),
    mediaAlt: row.cover?.altText ?? null,
    author: {
      id: row.author.id,
      fullName: row.author.fullName,
      avatarUrl: row.author.avatarUrl,
      // Resolved once here, not separately by every surface that names a publisher.
      entityName: entityDisplayName(row.publisher.name, row.publisher.kind),
    },
    publisherEntityId: row.publisher.id,
    entityFollowState: entityFollowStates.get(row.publisher.id) ?? "none",
    reactionCount: row.reactionCount,
    commentCount: row.commentCount,
    publishedAt: row.publishedAt ?? row.createdAt,
    topics: row.topics.map((t) => t.topic),
  };
}

// Shared so "visible" never drifts between callers. Both conditions nest
// under AND — each is itself an OR, so flattening would silently drop the
// expiry check.
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

// One extra indexed query per feed page (Follow's own unique index covers
// it), batched across distinct publishers rather than resolved per card.
function entityFollowStatesFor(
  userId: string,
  entityIds: string[]
): Promise<Map<string, FollowState>> {
  return followStatesFor(userId, FollowTarget.ENTITY, entityIds);
}

// Same shape, for the ranking affinity term below.
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

export const TOPIC_PAGE_SIZE = 12;

// Same audience-scoping as the main feed — a topic archive is never a way
// around targeting.
export type TopicSort = "recent" | "popular";

const TOPIC_SORT_ORDER: Record<TopicSort, Prisma.PostOrderByWithRelationInput[]> = {
  recent: [{ publishedAt: "desc" }, { id: "desc" }],
  popular: [{ reactionCount: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
};

export async function getTopicFeed(
  topicId: string,
  page: number,
  sort: TopicSort = "recent"
): Promise<{ posts: FeedPost[]; hasNext: boolean }> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);

  const rows = await db.post.findMany({
    where: { ...visiblePublishedWhere(scope), topics: { some: { topicId } } },
    orderBy: TOPIC_SORT_ORDER[sort],
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

export type TopicStats = {
  postCount: number;
  entityCount: number;
  followerCount: number;
  avgReadingMinutes: number;
};

// Every figure here is a real aggregate over the same visibility-scoped
// rows the list shows, never a stand-in — no "engagement" figure, since
// nothing upstream derives one honestly for a topic as a whole.
export async function getTopicStats(topicId: string): Promise<TopicStats> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);
  const where = { ...visiblePublishedWhere(scope), topics: { some: { topicId } } };

  const [postCount, entities, followerCount, avg] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      distinct: ["publisherEntityId"],
      select: { publisherEntityId: true },
    }),
    db.follow.count({ where: { targetType: FollowTarget.TOPIC, targetId: topicId, muted: false } }),
    db.post.aggregate({ where, _avg: { readingMinutes: true } }),
  ]);

  return {
    postCount,
    entityCount: entities.length,
    followerCount,
    avgReadingMinutes: Math.round(avg._avg.readingMinutes ?? 0),
  };
}

const BOOKMARKS_PAGE_SIZE = 12;

// Ordered by when bookmarked, not published — starting from Bookmark
// gives that for free. visiblePublishedWhere on the nested post drops a
// bookmark whose post was since unpublished or fell outside audience.
/** A bookmarked post plus when this reader saved it — "Saved 3 days ago"
 *  uses real `Bookmark.createdAt`, not the post's publish date. */
export type BookmarkedPost = FeedPost & { savedAt: Date };

export async function getBookmarkedPosts(
  page: number,
  topicId?: string
): Promise<{ posts: BookmarkedPost[]; hasNext: boolean }> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);
  const postWhere = {
    ...visiblePublishedWhere(scope),
    ...(topicId ? { topics: { some: { topicId } } } : {}),
  };

  const rows = await db.bookmark.findMany({
    where: { userId: user.id, post: postWhere },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * BOOKMARKS_PAGE_SIZE,
    take: BOOKMARKS_PAGE_SIZE + 1,
    select: { createdAt: true, post: { select: feedSelect } },
  });
  const page1 = rows.slice(0, BOOKMARKS_PAGE_SIZE);
  const entityFollowStates = await entityFollowStatesFor(user.id, [
    ...new Set(page1.map((r) => r.post.publisher.id)),
  ]);

  return {
    posts: page1.map((r) => ({
      ...toFeedPost(r.post, entityFollowStates),
      savedAt: r.createdAt,
    })),
    hasNext: rows.length > BOOKMARKS_PAGE_SIZE,
  };
}

export type BookmarkTopic = { id: string; name: string; kind: TopicKind };

// Only topics the viewer's bookmarks carry, not every topic in the system
// — a chip with nothing behind it is a dead end, not a filter.
export async function getBookmarkTopics(): Promise<BookmarkTopic[]> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);

  const rows = await db.postTopic.findMany({
    where: { post: { bookmarks: { some: { userId: user.id } }, ...visiblePublishedWhere(scope) } },
    distinct: ["topicId"],
    select: { topic: { select: { id: true, name: true, kind: true } } },
    orderBy: { topic: { name: "asc" } },
  });

  return rows.map((r) => r.topic);
}

export async function getBookmarksCount(): Promise<number> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);
  return db.bookmark.count({ where: { userId: user.id, post: visiblePublishedWhere(scope) } });
}

/** Exported so a profile's numbered index can continue its own numbering
 *  across pages rather than restarting at 01 on page two. */
export const PROFILE_PAGE_SIZE = 12;

// Author/entity profiles page through the same visibility-scoped list the
// feed enforces — a profile isn't a second way around scope.
export async function getAuthorPosts(
  authorId: string,
  page: number
): Promise<{ posts: FeedPost[]; hasNext: boolean }> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);

  const rows = await db.post.findMany({
    where: { ...visiblePublishedWhere(scope), authorId },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PROFILE_PAGE_SIZE,
    take: PROFILE_PAGE_SIZE + 1,
    select: feedSelect,
  });
  const page1 = rows.slice(0, PROFILE_PAGE_SIZE);
  const entityFollowStates = await entityFollowStatesFor(user.id, [
    ...new Set(page1.map((r) => r.publisher.id)),
  ]);

  return {
    posts: page1.map((r) => toFeedPost(r, entityFollowStates)),
    hasNext: rows.length > PROFILE_PAGE_SIZE,
  };
}

export async function getEntityPosts(
  entityId: string,
  page: number
): Promise<{ posts: FeedPost[]; hasNext: boolean }> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);

  const rows = await db.post.findMany({
    where: { ...visiblePublishedWhere(scope), publisherEntityId: entityId },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PROFILE_PAGE_SIZE,
    take: PROFILE_PAGE_SIZE + 1,
    select: feedSelect,
  });
  const page1 = rows.slice(0, PROFILE_PAGE_SIZE);
  const entityFollowStates = await entityFollowStatesFor(user.id, [
    ...new Set(page1.map((r) => r.publisher.id)),
  ]);

  return {
    posts: page1.map((r) => toFeedPost(r, entityFollowStates)),
    hasNext: rows.length > PROFILE_PAGE_SIZE,
  };
}

export async function getAuthorPostCount(authorId: string): Promise<number> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);
  return db.post.count({ where: { ...visiblePublishedWhere(scope), authorId } });
}

export async function getEntityPostCount(entityId: string): Promise<number> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);
  return db.post.count({ where: { ...visiblePublishedWhere(scope), publisherEntityId: entityId } });
}

// A raw sum rather than PROFILE_PAGE_SIZE-limited: the profile's stat strip
// states this author's total reach, not a per-page figure.
export async function getAuthorReactionTotal(authorId: string): Promise<number> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);
  const result = await db.post.aggregate({
    where: { ...visiblePublishedWhere(scope), authorId },
    _sum: { reactionCount: true },
  });
  return result._sum.reactionCount ?? 0;
}

const RELATED_POSTS_LIMIT = 4;

// Shared-topic posts first, then same-publisher-entity, both under
// visiblePublishedWhere — same "never a way around targeting" rule.
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
// Ranking: deterministic and weighted, no learned model — every term is
// inspectable via getPostRankingBreakdown.
//
// SQL bounds the candidates (visiblePublishedWhere + LIMIT 500, in
// rankingCandidatesFor); JS scores them, keeping the formula plain and
// testable, and shared by the feed and the per-post breakdown.
//
// Caching is keyed by scope set only — affinity/seen are per-viewer, so
// they're layered on at request time, never cached, or personalisation
// would flatten across viewers.
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

// Falls back to the seeded default, not zero — a DB hiccup should degrade
// ranking quality, not silently flatten a term to nothing.
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
 * Tiers of shared ancestry (Entity.path), not literal equality: a post
 * from an ancestor MC counts as "same MC", not "global". No primary
 * entity means no home base, so everything lands at the global floor.
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
 * `terms[*].weighted` always sums to `score` (seen's is pre-negated), so
 * the breakdown UI projects the exact numbers that ranked the feed.
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
      // 0 - seenWeighted, not unary negation: negating zero yields -0,
      // which is harmless but odd for Object.is-based test assertions.
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

// Redis round-trips through JSON, so Dates come back as strings on a hit
// but stay Date instances on a miss — converting explicitly at both ends
// keeps the shape identical regardless of backing store.
type CachedRankingRow = Omit<RankingRow, "publishedAt" | "createdAt" | "pinnedUntil"> & {
  publishedAt: string | null;
  createdAt: string;
  pinnedUntil: string | null;
};

/**
 * The expensive, shared half of ranking, cached per scope set
 * (cacheKeys.feedRanked explains why that's sound despite affinity/seen
 * being personal). The caller layers on personal terms — never cached here.
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

  // Re-filtered by visibility, not just id: the cached candidate window
  // can be up to 60s stale, and a post hidden meanwhile must not render.
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
 * Single-post scoring for the "why this appeared" disclosure (For You
 * mode). Independent of the cached 500-row window — a linked post outside
 * it still gets an accurate breakdown — but shares scorePost with the feed.
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

/**
 * "Elsewhere in the network": one query set, not two — the headline's
 * entity count and the list below must describe the same time window, or
 * the number becomes a lie the rows don't back up. The window widens
 * (week -> month -> all) until something is found, and is returned so the
 * caller's copy never claims a period the rows don't come from.
 */
export type ElsewhereWindow = "week" | "month" | "all";

export type ElsewhereDigest = {
  posts: FeedPost[];
  /** Distinct publishing entities visible to this viewer, within `window`. */
  entityCount: number;
  window: ElsewhereWindow;
};

const ELSEWHERE_TAKE = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const ELSEWHERE_WINDOWS: Array<{ key: ElsewhereWindow; days: number | null }> = [
  { key: "week", days: 7 },
  { key: "month", days: 30 },
  { key: "all", days: null },
];

export async function getElsewhereDigest(excludePostIds: string[]): Promise<ElsewhereDigest> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);
  const now = Date.now();

  for (const { key, days } of ELSEWHERE_WINDOWS) {
    const since = days === null ? undefined : new Date(now - days * DAY_MS);
    const where: Prisma.PostWhereInput = {
      ...visiblePublishedWhere(scope),
      ...(since ? { publishedAt: { gte: since, lte: new Date(now) } } : {}),
      // The lead complex already has these five on screen. Repeating one in
      // the closing index makes the page look shorter than it is.
      ...(excludePostIds.length > 0 ? { id: { notIn: excludePostIds } } : {}),
    };

    const [rows, publishers] = await Promise.all([
      db.post.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: ELSEWHERE_TAKE,
        select: feedSelect,
      }),
      db.post.findMany({
        where,
        distinct: ["publisherEntityId"],
        select: { publisherEntityId: true },
      }),
    ]);

    if (rows.length === 0 && key !== "all") continue;

    const entityFollowStates = await entityFollowStatesFor(user.id, [
      ...new Set(rows.map((r) => r.publisher.id)),
    ]);

    return {
      posts: rows.map((r) => toFeedPost(r, entityFollowStates)),
      entityCount: publishers.length,
      window: key,
    };
  }

  // Unreachable: the "all" window always returns.
  return { posts: [], entityCount: 0, window: "all" };
}

async function topAuthorsBy(
  scope: ScopeSet,
  options: { publishedAt?: { gte: Date }; publisherEntityId?: string } = {}
): Promise<TrendingAuthor[]> {
  const visible = await db.post.findMany({
    where: {
      status: PostStatus.PUBLISHED,
      ...(options.publishedAt ? { publishedAt: options.publishedAt } : {}),
      ...(options.publisherEntityId ? { publisherEntityId: options.publisherEntityId } : {}),
      ...visibilityFilter(scope),
    },
    select: { authorId: true },
  });

  const counts = new Map<string, number>();
  for (const row of visible) counts.set(row.authorId, (counts.get(row.authorId) ?? 0) + 1);
  if (counts.size === 0) return [];

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const authors = await db.user.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: {
      id: true,
      fullName: true,
      primaryEntity: { select: { name: true, kind: true } },
    },
  });

  return top
    .map(([id, postCount]) => {
      const author = authors.find((a) => a.id === id);
      return author
        ? {
            id,
            fullName: author.fullName,
            entityName: entityDisplayName(author.primaryEntity?.name, author.primaryEntity?.kind),
            postCount,
          }
        : null;
    })
    .filter((a): a is TrendingAuthor => a !== null);
}

/**
 * Falls back to all-time top publishers when nothing's gone out in 30
 * days, rather than rendering nothing — a quiet month should show who
 * publishes most, period, not disappear.
 */
export async function getTrendingAuthors(): Promise<TrendingAuthor[]> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const recent = await topAuthorsBy(scope, { publishedAt: { gte: since } });
  if (recent.length > 0) return recent;

  return topAuthorsBy(scope);
}

// Ranked by posts published under this entity specifically (publisherEntityId),
// not the author's primaryEntity — same attribution getEntityPosts already uses.
export async function getTopAuthorsForEntity(entityId: string): Promise<TrendingAuthor[]> {
  const user = await requireSession();
  const scope = await scopeSetFor(user);
  return topAuthorsBy(scope, { publisherEntityId: entityId });
}
