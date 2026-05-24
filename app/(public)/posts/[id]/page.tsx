import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PostStatus } from "@/app/generated/prisma/enums";
import { relativeTime } from "@/lib/relative-time";
import { PostAvatar } from "@/components/posts/_shared";
import { EngagementBar } from "@/components/post-detail/EngagementBar";
import { CommentsSection } from "@/components/post-detail/CommentsSection";
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
  content: true,
  deletedAt: true,
  createdAt: true,
  user: { select: { fullName: true, committeeName: true } },
} as const;

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [post, initialComments] = await Promise.all([
    db.post.findUnique({
      where: { id },
      include: {
        author: true,
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: user.id }, take: 1 },
      },
    }),
    db.comment.findMany({
      where: { postId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: commentSelect,
    }),
  ]);

  if (!post || post.status !== PostStatus.PUBLISHED) return notFound();

  const userLiked = post.likes.length > 0;
  const ago = relativeTime(post.createdAt);

  return (
    // pb-24 on mobile leaves room for the sticky engagement bar (~52px)
    <main className="mx-auto w-full max-w-[720px] px-6 py-8 pb-24 md:pb-16">

      {/* Back to feed */}
      <Link
        href="/feed"
        className="mb-8 inline-flex items-center gap-1.5 text-[14px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Back to feed
      </Link>

      {/* Hero image */}
      {post.mediaUrl && (
        <div className="mb-8 aspect-video w-full overflow-hidden rounded-2xl">
          <Image
            src={post.mediaUrl}
            alt={post.title}
            width={720}
            height={405}
            priority
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Title */}
      <h1 className="break-words font-black leading-[1.1] tracking-tight text-[var(--foreground)] text-[32px] md:text-[40px]">
        {post.title}
      </h1>

      {/* Author block */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <PostAvatar fullName={post.author.fullName} avatarUrl={null} size="lg" />
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-tight text-[var(--foreground)]">
            {post.author.fullName}
          </p>
          {post.author.committeeName && (
            <p className="text-[13px] text-[var(--muted-foreground)]">
              {post.author.committeeName}
            </p>
          )}
        </div>
        <span aria-hidden className="text-[var(--muted-foreground)]">
          ·
        </span>
        <time
          dateTime={post.createdAt.toISOString()}
          className="shrink-0 text-[13px] text-[var(--muted-foreground)]"
        >
          {ago}
        </time>
      </div>

      {/* Content body — max ~70ch for comfortable reading */}
      <div className="mt-8 max-w-[70ch]">
        {post.content
          .split("\n")
          .filter(Boolean)
          .map((para, i) => (
            <p
              key={i}
              className="mb-4 text-[18px] leading-[1.7] text-[var(--foreground)] last:mb-0"
            >
              {para}
            </p>
          ))}
      </div>

      {/* Link card */}
      {post.linkUrl && (
        <a
          href={post.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] px-5 py-4 transition-colors hover:border-[var(--primary)]"
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
        </a>
      )}

      {/* Engagement bar — desktop: inline above comments; mobile: sticky bottom (rendered inside component) */}
      <EngagementBar
        postId={post.id}
        initialLiked={userLiked}
        initialLikeCount={post._count.likes}
        commentCount={post._count.comments}
      />

      {/* Comments */}
      <CommentsSection
        postId={post.id}
        totalCount={post._count.comments}
        initialComments={initialComments.map(toCommentDto)}
        currentUserName={user.fullName}
      />
    </main>
  );
}
