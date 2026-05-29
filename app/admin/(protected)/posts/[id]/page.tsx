import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PostStatus } from "@/app/generated/prisma/enums";
import { relativeTime } from "@/lib/relative-time";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const STATUS_BADGE: Record<PostStatus, { label: string; className: string }> = {
  PUBLISHED: {
    label: "Published",
    className:
      "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_30%,transparent)]",
  },
  PENDING: {
    label: "Pending review",
    className:
      "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]",
  },
  REJECTED: {
    label: "Rejected",
    className:
      "bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] text-[var(--destructive)] border-[color-mix(in_srgb,var(--destructive)_30%,transparent)]",
  },
};

export default async function AdminPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();

  const post = await db.post.findUnique({
    where: { id },
    include: {
      author: true,
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!post) return notFound();

  const badge = STATUS_BADGE[post.status];
  const ago = relativeTime(post.createdAt);

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 py-8">
      {/* Back */}
      <Link
        href="/admin/posts"
        className="mb-8 inline-flex items-center gap-1.5 text-[14px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Back to posts
      </Link>

      {/* Status badge */}
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-[var(--radius-md)] border text-[13px] font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
        {post.status === PostStatus.REJECTED && post.rejectionReason && (
          <span className="text-[13px] text-[var(--muted-foreground)] italic">
            Reason: {post.rejectionReason}
          </span>
        )}
      </div>

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

      {/* Author + meta */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[15px] font-bold text-[var(--foreground)]">
          {post.author.fullName}
        </p>
        {post.author.committeeName && (
          <>
            <span className="text-[var(--muted-foreground)]" aria-hidden>·</span>
            <p className="text-[13px] text-[var(--muted-foreground)]">
              {post.author.committeeName}
            </p>
          </>
        )}
        <span className="text-[var(--muted-foreground)]" aria-hidden>·</span>
        <time
          dateTime={post.createdAt.toISOString()}
          className="shrink-0 text-[13px] text-[var(--muted-foreground)]"
        >
          {ago}
        </time>
      </div>

      {/* Engagement summary */}
      <div className="mt-3 flex items-center gap-4 text-[13px] text-[var(--muted-foreground)] tabular-nums">
        <span>{post._count.likes} likes</span>
        <span>{post._count.comments} comments</span>
      </div>

      {/* Content body */}
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
    </main>
  );
}
