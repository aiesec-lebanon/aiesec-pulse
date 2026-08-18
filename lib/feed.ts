import "server-only";

import { PostStatus } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { audienceFilter, scopeSetFor } from "@/lib/org/scope";
import { requireSession } from "@/lib/rbac/guards";
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
  publisher: { select: { name: true, tag: true } },
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
  publisher: { name: string; tag: string | null };
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

export function toFeedPost(row: FeedRow): FeedPost {
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
    reactionCount: row.reactionCount,
    commentCount: row.commentCount,
    publishedAt: row.publishedAt ?? row.createdAt,
    topics: row.topics.map((t) => t.topic),
  };
}

// Shared by getFeedPage and getTopicFeed so "what counts as visible" can
// never drift between the main feed and a topic archive.
function visiblePublishedWhere(scope: Parameters<typeof audienceFilter>[0]) {
  return {
    status: PostStatus.PUBLISHED,
    publishedAt: { lte: new Date() },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    ...audienceFilter(scope),
  };
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

  return {
    posts: rows.slice(0, POSTS_PER_PAGE).map(toFeedPost),
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

  return {
    posts: rows.slice(0, TOPIC_PAGE_SIZE).map(toFeedPost),
    hasNext: rows.length > TOPIC_PAGE_SIZE,
  };
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
      ...audienceFilter(scope),
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
