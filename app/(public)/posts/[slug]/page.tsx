import { ArrowLeft, ExternalLink } from "lucide-react";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { promotionBudgetFor } from "@/app/actions/posts";
import { CommentStatus, PostStatus } from "@/app/generated/prisma/enums";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { CommentsSection } from "@/components/post-detail/CommentsSection";
import { DocumentRenderer, type MediaLookup } from "@/components/post-detail/DocumentRenderer";
import { EngagementBar } from "@/components/post-detail/EngagementBar";
import { PromotionControls } from "@/components/post-detail/PromotionControls";
import { ReadingProgress } from "@/components/post-detail/ReadingProgress";
import { RelatedPosts } from "@/components/post-detail/RelatedPosts";
import { WhyThisAppeared } from "@/components/post-detail/WhyThisAppeared";
import { PostAvatar } from "@/components/posts/_shared";
import { TopicChip } from "@/components/topics/TopicChip";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { collectImageMediaIds, sanitiseDocument } from "@/lib/content/document";
import { db } from "@/lib/db";
import { getPostRankingBreakdown, getRelatedPosts, mediaUrl } from "@/lib/feed";
import { FEED_MODE_COOKIE, parseFeedMode } from "@/lib/feed-mode";
import { isEnabled } from "@/lib/flags";
import { scopeSetFor, visibilityFilter } from "@/lib/org/scope";
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

  // "Why this appeared" is a For You-mode-only disclosure (architecture.md
  // §11) — Latest is an explicitly unranked escape hatch, so there is
  // nothing for it to explain there.
  const rankedAvailable = await isEnabled("feed.ranked");
  const cookieStore = await cookies();
  const showWhyThisAppeared =
    rankedAvailable && parseFeedMode(cookieStore.get(FEED_MODE_COOKIE)?.value) === "for-you";

  const post = await db.post.findFirst({
    where: { slug, status: PostStatus.PUBLISHED, ...visibilityFilter(scope) },
    select: {
      id: true,
      title: true,
      summary: true,
      bodyJson: true,
      linkUrl: true,
      readingMinutes: true,
      level: true,
      publishedAt: true,
      createdAt: true,
      reactionCount: true,
      commentCount: true,
      publisherEntityId: true,
      cover: { select: { bucket: true, path: true, altText: true } },
      author: { select: { fullName: true, avatarUrl: true } },
      publisher: { select: { name: true } },
      reactions: { where: { userId: user.id }, take: 1, select: { userId: true } },
      bookmarks: { where: { userId: user.id }, take: 1, select: { userId: true } },
      topics: { select: { topicId: true, topic: { select: { slug: true, name: true } } } },
    },
  });

  if (!post) return notFound();

  // Inline image blocks store a mediaId, not a URL (lib/content/document.ts)
  // — resolved here rather than inside DocumentRenderer, which stays a pure
  // render function over whatever lookup its caller already has.
  const imageMediaIds = collectImageMediaIds(sanitiseDocument(post.bodyJson));

  const [initialComments, inlineMedia, rankingBreakdown, relatedPosts, promotionBudget] =
    await Promise.all([
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
      showWhyThisAppeared ? getPostRankingBreakdown(post.id) : Promise.resolve(null),
      getRelatedPosts(
        post.id,
        post.publisherEntityId,
        post.topics.map((t) => t.topicId)
      ),
      // Null for everyone who cannot promote this post, which is what hides
      // the control rather than rendering a disabled one.
      promotionBudgetFor(post.id),
    ]);

  const bodyMedia: MediaLookup = Object.fromEntries(
    inlineMedia
      .map((media) => [media.id, mediaUrl(media)] as const)
      .filter((entry): entry is [string, string] => entry[1] !== null)
  );

  const publishedAt = post.publishedAt ?? post.createdAt;
  const cover = mediaUrl(post.cover);

  return (
    <main className="pb-24 md:pb-16">
      <ReadingProgress />

      {/* The cover breaks the reading measure deliberately: it is the one
          cinematic beat on a page whose job is otherwise to get out of the
          way. It drifts against the scroll inside a fixed frame, so the
          headline below rises past a moving image rather than a static one. */}
      {cover ? (
        <header className="relative">
          <div className="pulse-media-frame relative aspect-[4/3] w-full overflow-hidden rounded-none sm:aspect-[16/9] lg:aspect-[21/9]">
            <Parallax depth={-70} scale={1.18} className="absolute inset-0">
              <Image
                src={cover}
                alt={post.cover?.altText ?? ""}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </Parallax>
            <span aria-hidden className="pulse-image-scrim" />
          </div>

          <div className="mx-auto -mt-24 w-full max-w-[760px] px-6 sm:-mt-28">
            <Reveal y={24} className="pulse-plate p-7 shadow-[var(--elev-4)] sm:p-10">
              <PostHeading title={post.title} />
            </Reveal>
          </div>
        </header>
      ) : (
        <header className="mx-auto w-full max-w-[760px] px-6 pt-16">
          <Reveal y={24}>
            <PostHeading title={post.title} />
          </Reveal>
        </header>
      )}

      <div className="mx-auto w-full max-w-[760px] px-6">
        <Reveal y={20} delay={80}>
          <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-3 border-y border-[var(--hairline)] py-5">
            <PostAvatar
              fullName={post.author.fullName}
              avatarUrl={post.author.avatarUrl}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-tight text-[color:var(--foreground)]">
                {post.author.fullName}
              </p>
              <p className="mt-0.5 text-[13px] text-[color:var(--muted-foreground)]">
                {post.publisher.name}
              </p>
            </div>

            <LevelBadge level={post.level} className="ml-auto" />

            <p className="pulse-label flex shrink-0 items-center gap-3 text-[10px]">
              <time dateTime={publishedAt.toISOString()} className="tracking-[0.12em]">
                {relativeTime(publishedAt)}
              </time>
              <span aria-hidden>/</span>
              <span className="tracking-[0.12em]">{post.readingMinutes} min read</span>
            </p>
          </div>
        </Reveal>

        {post.topics.length > 0 && (
          <Reveal y={16} delay={140}>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {post.topics.map(({ topic }) => (
                <TopicChip key={topic.slug} slug={topic.slug} name={topic.name} />
              ))}
            </div>
          </Reveal>
        )}

        {/* ~70ch keeps line length in the comfortable reading range. */}
        <Reveal y={20} delay={180} className="mt-10 max-w-[70ch]">
          <DocumentRenderer doc={post.bodyJson} media={bodyMedia} />
        </Reveal>

        {post.linkUrl && (
          <Reveal y={16}>
            <a
              href={post.linkUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="pulse-plate pulse-plate-interactive mt-10 flex items-center justify-between gap-4 px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              <div className="min-w-0">
                <p className="pulse-label text-[10px]">Source</p>
                <p className="mt-1.5 truncate text-[15px] font-bold text-[color:var(--foreground)]">
                  {extractDomain(post.linkUrl)}
                </p>
                <p className="mt-0.5 truncate text-[13px] text-[color:var(--muted-foreground)]">
                  {post.linkUrl}
                </p>
              </div>
              <ExternalLink
                size={16}
                strokeWidth={2}
                className="shrink-0 text-[color:var(--muted-foreground)]"
                aria-hidden
              />
              <span className="sr-only">Opens in a new tab</span>
            </a>
          </Reveal>
        )}

        <EngagementBar
          postId={post.id}
          initialReacted={post.reactions.length > 0}
          initialReactionCount={post.reactionCount}
          initialBookmarked={post.bookmarks.length > 0}
          commentCount={post.commentCount}
        />

        {promotionBudget && (
          <PromotionControls
            postId={post.id}
            postTitle={post.title}
            level={post.level}
            budget={promotionBudget}
          />
        )}

        {rankingBreakdown && <WhyThisAppeared breakdown={rankingBreakdown} />}

        <RelatedPosts posts={relatedPosts} />

        <CommentsSection
          postId={post.id}
          totalCount={post.commentCount}
          initialComments={initialComments.map(toCommentDto)}
          currentUserName={user.fullName}
        />
      </div>

      <div className="mx-auto mt-16 w-full max-w-[1240px] px-6">
        <BackToFeed />
      </div>
    </main>
  );
}

function PostHeading({ title }: { title: string }) {
  return (
    <h1 className="pulse-display pulse-display-md break-words text-[color:var(--foreground)]">
      {title}
    </h1>
  );
}

function BackToFeed() {
  return (
    <Link
      href="/feed"
      className="group inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-sm)] text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      <ArrowLeft
        size={15}
        strokeWidth={2.5}
        aria-hidden
        className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:-translate-x-[calc(3px*var(--motion-travel))]"
      />
      Back to feed
    </Link>
  );
}
