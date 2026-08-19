import { ArrowLeft, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentStatus, PostStatus } from "@/app/generated/prisma/enums";
import { CommentsSection } from "@/components/post-detail/CommentsSection";
import { DocumentRenderer, type MediaLookup } from "@/components/post-detail/DocumentRenderer";
import { EngagementBar } from "@/components/post-detail/EngagementBar";
import { PostAvatar } from "@/components/posts/_shared";
import { TopicChip } from "@/components/topics/TopicChip";
import { collectImageMediaIds, sanitiseDocument } from "@/lib/content/document";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/feed";
import { audienceFilter, scopeSetFor } from "@/lib/org/scope";
import { requireSession } from "@/lib/rbac/guards";
import { relativeTime } from "@/lib/relative-time";
import { toCommentDto } from "@/types/comment";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const commentSelect = {
  id: true,
  body: true,
  status: true,
  hiddenReason: true,
  createdAt: true,
  user: { select: { fullName: true, primaryEntity: { select: { name: true } } } },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await db.post.findUnique({
    where: { slug },
    select: { title: true, summary: true, status: true },
  });
  if (!post || post.status !== PostStatus.PUBLISHED) return { title: "Post not found" };
  return { title: `${post.title} · AIESEC Pulse`, description: post.summary ?? undefined };
}

export default async function PostDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireSession();
  const scope = await scopeSetFor(user);

  const post = await db.post.findFirst({
    where: { slug, status: PostStatus.PUBLISHED, ...audienceFilter(scope) },
    select: {
      id: true,
      title: true,
      summary: true,
      bodyJson: true,
      linkUrl: true,
      readingMinutes: true,
      publishedAt: true,
      createdAt: true,
      reactionCount: true,
      commentCount: true,
      cover: { select: { bucket: true, path: true, altText: true } },
      author: { select: { fullName: true, avatarUrl: true } },
      publisher: { select: { name: true } },
      reactions: { where: { userId: user.id }, take: 1, select: { userId: true } },
      bookmarks: { where: { userId: user.id }, take: 1, select: { userId: true } },
      topics: { select: { topic: { select: { slug: true, name: true } } } },
    },
  });

  if (!post) return notFound();

  // Inline image blocks store a mediaId, not a URL (lib/content/document.ts)
  // — resolved here rather than inside DocumentRenderer, which stays a pure
  // render function over whatever lookup its caller already has.
  const imageMediaIds = collectImageMediaIds(sanitiseDocument(post.bodyJson));

  const [initialComments, inlineMedia] = await Promise.all([
    db.comment.findMany({
      where: { postId: post.id, status: { not: CommentStatus.HIDDEN } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: commentSelect,
    }),
    imageMediaIds.length > 0
      ? db.media.findMany({
          where: { id: { in: imageMediaIds } },
          select: { id: true, bucket: true, path: true },
        })
      : Promise.resolve([]),
  ]);

  const bodyMedia: MediaLookup = Object.fromEntries(
    inlineMedia
      .map((media) => [media.id, mediaUrl(media)] as const)
      .filter((entry): entry is [string, string] => entry[1] !== null)
  );

  const publishedAt = post.publishedAt ?? post.createdAt;
  const cover = mediaUrl(post.cover);

  return (
    // pb-24 on mobile leaves room for the sticky engagement bar (~52px).
    <main className="mx-auto w-full max-w-[720px] px-6 py-8 pb-24 md:pb-16">
      <Link
        href="/feed"
        className="mb-8 inline-flex min-h-[24px] items-center gap-1.5 rounded-[var(--radius-sm)] text-[14px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Back to feed
      </Link>

      {cover && (
        <div className="mb-8 aspect-video w-full overflow-hidden rounded-2xl">
          <Image
            src={cover}
            alt={post.cover?.altText ?? ""}
            width={720}
            height={405}
            priority
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <h1 className="break-words text-[32px] font-black leading-[1.1] tracking-tight text-[var(--foreground)] md:text-[40px]">
        {post.title}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <PostAvatar fullName={post.author.fullName} avatarUrl={post.author.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-tight text-[var(--foreground)]">
            {post.author.fullName}
          </p>
          <p className="text-[13px] text-[var(--muted-foreground)]">{post.publisher.name}</p>
        </div>
        <span aria-hidden className="text-[var(--muted-foreground)]">
          ·
        </span>
        <time
          dateTime={publishedAt.toISOString()}
          className="shrink-0 text-[13px] text-[var(--muted-foreground)]"
        >
          {relativeTime(publishedAt)}
        </time>
        <span aria-hidden className="text-[var(--muted-foreground)]">
          ·
        </span>
        <span className="shrink-0 text-[13px] text-[var(--muted-foreground)]">
          {post.readingMinutes} min read
        </span>
      </div>

      {post.topics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {post.topics.map(({ topic }) => (
            <TopicChip key={topic.slug} slug={topic.slug} name={topic.name} />
          ))}
        </div>
      )}

      {/* ~70ch keeps line length in the comfortable reading range. */}
      <div className="mt-8 max-w-[70ch]">
        <DocumentRenderer doc={post.bodyJson} media={bodyMedia} />
      </div>

      {post.linkUrl && (
        <a
          href={post.linkUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-8 flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] px-5 py-4 transition-colors hover:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-[var(--foreground)]">
              {extractDomain(post.linkUrl)}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-[var(--muted-foreground)]">
              {post.linkUrl}
            </p>
          </div>
          <ExternalLink
            size={16}
            strokeWidth={2}
            className="shrink-0 text-[var(--muted-foreground)]"
            aria-hidden
          />
          <span className="sr-only">Opens in a new tab</span>
        </a>
      )}

      <EngagementBar
        postId={post.id}
        initialReacted={post.reactions.length > 0}
        initialReactionCount={post.reactionCount}
        initialBookmarked={post.bookmarks.length > 0}
        commentCount={post.commentCount}
      />

      <CommentsSection
        postId={post.id}
        totalCount={post.commentCount}
        initialComments={initialComments.map(toCommentDto)}
        currentUserName={user.fullName}
      />
    </main>
  );
}
