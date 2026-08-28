import { ExternalLink } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { promotionBudgetFor } from "@/app/actions/posts";
import { CommentStatus, PostStatus } from "@/app/generated/prisma/enums";
import { Reveal } from "@/components/motion/Reveal";
import { CommentsSection } from "@/components/post-detail/CommentsSection";
import { DocumentRenderer, type MediaLookup } from "@/components/post-detail/DocumentRenderer";
import { EngagementBar } from "@/components/post-detail/EngagementBar";
import { PromotionControls } from "@/components/post-detail/PromotionControls";
import { ReadingIndex } from "@/components/post-detail/ReadingIndex";
import { ReadingProgress } from "@/components/post-detail/ReadingProgress";
import { StoryHero } from "@/components/post-detail/StoryHero";
import { UpNextRotator } from "@/components/post-detail/UpNextRotator";
import { WhyThisAppeared } from "@/components/post-detail/WhyThisAppeared";
import { PostAvatar } from "@/components/posts/_shared";
import { EntityName } from "@/components/ui/EntityName";
import { collectImageMediaIds, extractSections, sanitiseDocument } from "@/lib/content/document";
import { db } from "@/lib/db";
import { getPostRankingBreakdown, getRelatedPosts, mediaUrl } from "@/lib/feed";
import { FEED_MODE_COOKIE, parseFeedMode } from "@/lib/feed-mode";
import { isEnabled } from "@/lib/flags";
import { entityDisplayName } from "@/lib/org/display";
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
  user: { select: { fullName: true, primaryEntity: { select: { name: true, kind: true } } } },
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

  // "Why this appeared" is a For You-mode-only disclosure — Latest is an
  // explicitly unranked escape hatch, so there is nothing to explain there.
  const rankedAvailable = await isEnabled("feed.ranked");
  const cookieStore = await cookies();
  const showWhyThisAppeared =
    rankedAvailable && parseFeedMode(cookieStore.get(FEED_MODE_COOKIE)?.value) === "for-you";

  const post = await db.post.findFirst({
    where: { slug, status: PostStatus.PUBLISHED, ...visibilityFilter(scope) },
    select: {
      id: true,
      title: true,
      titleAccent: true,
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
      author: { select: { id: true, fullName: true, avatarUrl: true } },
      publisher: { select: { name: true, kind: true } },
      reactions: { where: { userId: user.id }, take: 1, select: { userId: true } },
      bookmarks: { where: { userId: user.id }, take: 1, select: { userId: true } },
      topics: {
        select: { topicId: true, topic: { select: { slug: true, name: true, kind: true } } },
      },
    },
  });

  if (!post) return notFound();

  // Inline image blocks store a mediaId, not a URL (lib/content/document.ts)
  // — resolved here rather than inside DocumentRenderer, which stays a pure
  // render function over whatever lookup its caller already has.
  const sanitisedBody = sanitiseDocument(post.bodyJson);
  const imageMediaIds = collectImageMediaIds(sanitisedBody);
  // The section list needs two or more headings to be a table of contents at
  // all; the reading rail itself is unconditional, because every article has
  // progress. `ReadingIndex` owns that distinction — see its own note.
  const sections = extractSections(sanitisedBody);

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
  const primaryTopic = post.topics[0]?.topic ?? null;
  // "Lebanon" is a country; "AIESEC in Lebanon" is the office that published
  // this. Resolved once here and threaded through every surface on the page.
  const publisherName =
    entityDisplayName(post.publisher.name, post.publisher.kind) ?? post.publisher.name;

  const specCells = [
    { label: "Entity", value: <EntityName name={publisherName} /> },
    {
      label: "Published",
      value: (
        <time dateTime={publishedAt.toISOString()}>
          {publishedAt.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </time>
      ),
    },
    { label: "Reading", value: `${post.readingMinutes} min` },
    { label: "Reactions", value: <span className="tabular">{post.reactionCount}</span> },
  ];

  return (
    <main className="pb-24 md:pb-16">
      <ReadingProgress />

      <StoryHero
        title={post.title}
        titleAccent={post.titleAccent}
        cover={cover}
        coverAlt={post.cover?.altText ?? ""}
        primaryTopic={primaryTopic}
        entityName={publisherName}
        specCells={specCells}
      />

      {/* The reading column starts a clear step below the hero — without it the
          rail's first hairline landed flush against the bottom edge of the
          hero's spec strip, two unrelated rules touching. The rail column is
          unconditional now: it always carries the read percentage, and adds the
          section list when the story has headings. */}
      <div className="mx-auto w-full max-w-[1240px] px-6 pt-12 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-12 lg:pt-16">
        <aside className="pulse-sticky-rail hidden lg:block">
          {/* Measured against the prose, not the column: everything after the
              last paragraph is not reading. */}
          <ReadingIndex sections={sections} contentId="story-body" />
        </aside>

        <div id="story-content" className="mx-auto w-full max-w-[760px] lg:mx-0">
          <Reveal y={20} delay={80}>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-3 border-y border-[var(--hairline)] py-5">
              <div className="flex items-center gap-3">
                <PostAvatar
                  fullName={post.author.fullName}
                  avatarUrl={post.author.avatarUrl}
                  size="md"
                />
                <div className="min-w-0">
                  <Link
                    href={`/authors/${post.author.id}`}
                    className="pulse-underline block truncate text-[15px] font-bold leading-tight text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    {post.author.fullName}
                  </Link>
                  <Link
                    href={`/entities/${post.publisherEntityId}`}
                    className="pulse-underline mt-0.5 block truncate text-[13px] text-[color:var(--muted-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    <EntityName name={publisherName} />
                  </Link>
                </div>
              </div>

              <p className="pulse-label flex shrink-0 items-center gap-3 text-[10px]">
                <time dateTime={publishedAt.toISOString()} className="tracking-[0.12em]">
                  {relativeTime(publishedAt)}
                </time>
                <span aria-hidden>/</span>
                <span className="tracking-[0.12em]">{post.readingMinutes} min read</span>
              </p>
            </div>
          </Reveal>

          <Reveal y={20} delay={180} className="mt-10 max-w-[70ch]">
            <div id="story-body">
              <DocumentRenderer doc={post.bodyJson} media={bodyMedia} />
            </div>
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
        </div>
      </div>

      <UpNextRotator posts={relatedPosts} />

      <div className="mx-auto mt-16 w-full max-w-[760px] px-6">
        <CommentsSection
          postId={post.id}
          totalCount={post.commentCount}
          initialComments={initialComments.map(toCommentDto)}
          currentUserName={user.fullName}
        />
      </div>
    </main>
  );
}
