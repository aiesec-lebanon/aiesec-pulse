import Link from "next/link";
import { ArrowLeft, Heart, MessageCircle, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PostStatus } from "@/app/generated/prisma/enums";
import { relativeTime } from "@/lib/relative-time";
import { RejectedPostPanel } from "@/components/profile/RejectedPostPanel";

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const STATUS_BADGE: Record<
  PostStatus,
  { label: string; className: string }
> = {
  PUBLISHED: {
    label: "Published",
    className:
      "bg-[color-mix(in_srgb,var(--success)_12%,var(--card))] text-[var(--success)] border border-[var(--success)]/30",
  },
  PENDING: {
    label: "Queued",
    className:
      "bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] text-[var(--destructive)] border border-[var(--destructive)]/30",
  },
  REJECTED: {
    label: "Rejected",
    className:
      "bg-[color-mix(in_srgb,var(--muted-foreground)_12%,var(--card))] text-[var(--muted-foreground)] border border-[var(--border)]",
  },
};

// ── Data ──────────────────────────────────────────────────────────────────────

async function getUserPosts(userId: string) {
  return db.post.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      linkUrl: true,
      mediaUrl: true,
      rejectionReason: true,
      createdAt: true,
      _count: { select: { likes: true, comments: true } },
    },
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProfilePage() {
  const user = await requireUser();
  const posts = await getUserPosts(user.id);

  const published = posts.filter((p) => p.status === PostStatus.PUBLISHED);
  const pending = posts.filter((p) => p.status === PostStatus.PENDING);
  const rejected = posts.filter((p) => p.status === PostStatus.REJECTED);
  const totalLikes = posts.reduce((sum, p) => sum + p._count.likes, 0);
  const totalComments = posts.reduce((sum, p) => sum + p._count.comments, 0);

  const mono = avatarInitials(user.fullName);
  const memberSince = user.createdAt.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10">

      {/* Back link */}
      <Link
        href="/feed"
        className="mb-8 inline-flex items-center gap-1.5 text-[14px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Back to feed
      </Link>

      {/* ── Identity card ─────────────────────────────────────────────────── */}
      <div className="aiesec-card mb-8 flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 select-none items-center justify-center rounded-full bg-[var(--primary)] text-[20px] font-bold text-[var(--primary-foreground)]"
          >
            {mono}
          </span>

          {/* Name + entity */}
          <div>
            <h1 className="text-[24px] font-black leading-tight text-[var(--foreground)]">
              {user.fullName}
            </h1>
            {user.committeeName && (
              <p className="mt-0.5 text-[15px] text-[var(--muted-foreground)]">
                {user.committeeName}
              </p>
            )}
            <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
              Member since {memberSince}
            </p>
          </div>
        </div>

        {/* CTA */}
        <Link href="/posts/new" className="aiesec-btn-primary shrink-0 self-start">
          New post
        </Link>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Published" value={published.length} accent="success" />
        <StatCard label="Queued" value={pending.length} accent="warning" />
        <StatCard label="Rejected" value={rejected.length} accent="muted" />
        <StatCard label="Likes received" value={totalLikes} accent="primary" />
      </div>

      {/* ── Posts list ────────────────────────────────────────────────────── */}
      <section aria-label="Your posts">
        <h2 className="mb-4 text-[16px] font-bold text-[var(--foreground)]">
          Your posts
          <span className="ml-2 text-[14px] font-normal text-[var(--muted-foreground)]">
            ({posts.length})
          </span>
        </h2>

        {posts.length === 0 ? (
          <div className="aiesec-card px-8 py-12 text-center">
            <p className="text-[16px] text-[var(--muted-foreground)]">
              You haven&apos;t posted anything yet.
            </p>
            <Link href="/posts/new" className="aiesec-btn-primary mt-6 inline-flex">
              Write your first update
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {posts.map((post) => {
              const badge = STATUS_BADGE[post.status];
              const ago = relativeTime(post.createdAt);
              const isRejected = post.status === PostStatus.REJECTED;
              const isPublished = post.status === PostStatus.PUBLISHED;

              return (
                <div key={post.id} className="aiesec-card p-4">
                  {/* Row: badge + title + meta */}
                  <div className="flex flex-wrap items-start gap-3">
                    {/* Status badge */}
                    <span
                      className={`mt-0.5 shrink-0 rounded-[var(--radius-md)] px-2 py-0.5 text-[12px] font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>

                    {/* Title */}
                    <div className="min-w-0 flex-1">
                      {isPublished ? (
                        <Link
                          href={`/posts/${post.id}`}
                          className="text-[15px] font-bold leading-snug text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                        >
                          {post.title}
                        </Link>
                      ) : (
                        <p className="text-[15px] font-bold leading-snug text-[var(--foreground)]">
                          {post.title}
                        </p>
                      )}
                    </div>

                    {/* Right cluster: engagement + time */}
                    <div className="flex shrink-0 flex-wrap items-center gap-3 text-[13px] text-[var(--muted-foreground)]">
                      {isPublished && (
                        <>
                          <span className="flex items-center gap-1">
                            <Heart size={12} strokeWidth={2} aria-hidden />
                            {post._count.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle size={12} strokeWidth={2} aria-hidden />
                            {post._count.comments}
                          </span>
                        </>
                      )}
                      <time
                        dateTime={post.createdAt.toISOString()}
                        className="text-[13px] text-[var(--muted-foreground)]"
                      >
                        {ago}
                      </time>
                      {isPublished && (
                        <Link
                          href={`/posts/${post.id}`}
                          className="flex items-center gap-1 text-[13px] font-medium text-[var(--primary)] hover:underline"
                          aria-label={`View ${post.title}`}
                        >
                          <ExternalLink size={12} strokeWidth={2} aria-hidden />
                          View
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Excerpt — shown for non-published posts only */}
                  {!isPublished && (
                    <p className="mt-2 line-clamp-2 text-[13px] leading-[1.5] text-[var(--muted-foreground)]">
                      {post.content}
                    </p>
                  )}

                  {/* Pending hint */}
                  {post.status === PostStatus.PENDING && (
                    <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">
                      Pending moderator review — typically within 24 hours.
                    </p>
                  )}

                  {/* Rejected — review & edit panel */}
                  {isRejected && (
                    <RejectedPostPanel
                      post={{
                        id: post.id,
                        title: post.title,
                        content: post.content,
                        linkUrl: post.linkUrl,
                        mediaUrl: post.mediaUrl,
                        rejectionReason: post.rejectionReason,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Engagement summary (only if user has published posts) ─────────── */}
      {published.length > 0 && (
        <section aria-label="Engagement summary" className="mt-8">
          <h2 className="mb-4 text-[16px] font-bold text-[var(--foreground)]">
            Engagement
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <StatCard label="Total likes" value={totalLikes} accent="primary" />
            <StatCard label="Total comments" value={totalComments} accent="success" />
          </div>
        </section>
      )}
    </main>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

type Accent = "primary" | "success" | "warning" | "muted";

const ACCENT_CLASS: Record<Accent, string> = {
  primary: "text-[var(--primary)]",
  success: "text-[var(--success)]",
  warning: "text-[var(--destructive)]",
  muted: "text-[var(--muted-foreground)]",
};

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: Accent;
}) {
  return (
    <div className="aiesec-card px-5 py-4">
      <p className={`text-[28px] font-bold ${ACCENT_CLASS[accent]}`}>{value}</p>
      <p className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}
