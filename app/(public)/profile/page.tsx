import { ArrowLeft, ExternalLink, Heart, MessageCircle } from "lucide-react";
import Link from "next/link";

import { PostStatus } from "@/app/generated/prisma/enums";
import { RejectedPostPanel } from "@/components/profile/RejectedPostPanel";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/feed";
import { isEnabled } from "@/lib/flags";
import { can } from "@/lib/rbac/can";
import { requireSession } from "@/lib/rbac/guards";
import { relativeTime } from "@/lib/relative-time";

const STATUS_BADGE: Partial<Record<PostStatus, { label: string; className: string }>> = {
  PUBLISHED: {
    label: "Published",
    className:
      "bg-[color-mix(in_srgb,var(--success)_12%,var(--card))] text-[var(--success-text)] border border-[var(--success)]/30",
  },
  IN_REVIEW: {
    label: "In review",
    className:
      "bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] text-[var(--destructive-text)] border border-[var(--destructive)]/30",
  },
  REJECTED: {
    label: "Rejected",
    className:
      "bg-[color-mix(in_srgb,var(--muted-foreground)_12%,var(--card))] text-[var(--muted-foreground)] border border-[var(--border)]",
  },
  HIDDEN: {
    label: "Hidden",
    className:
      "bg-[color-mix(in_srgb,var(--muted-foreground)_12%,var(--card))] text-[var(--muted-foreground)] border border-[var(--border)]",
  },
  DRAFT: {
    label: "Draft",
    className: "bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]",
  },
  SCHEDULED: {
    label: "Scheduled",
    className:
      "bg-[color-mix(in_srgb,var(--primary)_10%,var(--card))] text-[var(--primary-text)] border border-[var(--primary)]/30",
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]",
  },
};

function avatarInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function ProfilePage() {
  const user = await requireSession();
  const canPublish = await can(user, "post.publish");

  const [posts, entity, richTextEnabled] = await Promise.all([
    db.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        bodyText: true,
        bodyJson: true,
        status: true,
        linkUrl: true,
        rejectionReason: true,
        hiddenReason: true,
        createdAt: true,
        publishedAt: true,
        scheduledAt: true,
        reactionCount: true,
        commentCount: true,
        cover: { select: { bucket: true, path: true, altText: true } },
      },
    }),
    user.primaryEntityId
      ? db.entity.findUnique({ where: { id: user.primaryEntityId }, select: { name: true } })
      : Promise.resolve(null),
    isEnabled("posts.rich_text"),
  ]);

  const published = posts.filter((p) => p.status === PostStatus.PUBLISHED);
  const inReview = posts.filter((p) => p.status === PostStatus.IN_REVIEW);
  const rejected = posts.filter((p) => p.status === PostStatus.REJECTED);
  const totalReactions = posts.reduce((sum, p) => sum + p.reactionCount, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.commentCount, 0);

  const memberSince = user.createdAt.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10">
      <Link
        href="/feed"
        className="mb-8 inline-flex min-h-[24px] items-center gap-1.5 rounded-[var(--radius-sm)] text-[14px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Back to feed
      </Link>

      <div className="aiesec-card mb-8 flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-5">
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 select-none items-center justify-center rounded-full bg-[var(--primary-fill)] text-[20px] font-bold text-[var(--primary-foreground)]"
          >
            {avatarInitials(user.fullName)}
          </span>

          <div>
            <h1 className="text-[24px] font-black leading-tight text-[var(--foreground)]">
              {user.fullName}
            </h1>
            {entity?.name && (
              <p className="mt-0.5 text-[15px] text-[var(--muted-foreground)]">{entity.name}</p>
            )}
            <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
              Member since {memberSince}
            </p>
          </div>
        </div>

        {canPublish && (
          <div className="flex shrink-0 flex-wrap gap-3 self-start">
            <Link href="/posts/new" className="aiesec-btn-primary">
              New post
            </Link>
            <Link href="/drafts" className="aiesec-btn-secondary">
              My drafts
            </Link>
          </div>
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Published" value={published.length} accent="success" />
        <StatCard label="In review" value={inReview.length} accent="warning" />
        <StatCard label="Rejected" value={rejected.length} accent="muted" />
        <StatCard label="Reactions received" value={totalReactions} accent="primary" />
      </div>

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
              {canPublish
                ? "You haven't posted anything yet."
                : "You haven't posted anything. Publishing is available to entity publishers and editors."}
            </p>
            {canPublish && (
              <Link href="/posts/new" className="aiesec-btn-primary mt-6 inline-flex">
                Write your first update
              </Link>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {posts.map((post) => {
              const badge = STATUS_BADGE[post.status];
              const shownAt = post.publishedAt ?? post.createdAt;
              const isPublished = post.status === PostStatus.PUBLISHED;

              return (
                <li key={post.id} className="aiesec-card p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    {badge && (
                      <span
                        className={`mt-0.5 shrink-0 rounded-[var(--radius-md)] px-2 py-0.5 text-[12px] font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      {isPublished ? (
                        <Link
                          href={`/posts/${post.slug}`}
                          className="text-[15px] font-bold leading-snug text-[var(--foreground)] transition-colors hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                        >
                          {post.title}
                        </Link>
                      ) : (
                        <p className="text-[15px] font-bold leading-snug text-[var(--foreground)]">
                          {post.title}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-3 text-[13px] text-[var(--muted-foreground)]">
                      {isPublished && (
                        <>
                          <span className="flex items-center gap-1">
                            <Heart size={12} strokeWidth={2} aria-hidden />
                            {post.reactionCount}
                            <span className="sr-only"> reactions</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle size={12} strokeWidth={2} aria-hidden />
                            {post.commentCount}
                            <span className="sr-only"> comments</span>
                          </span>
                        </>
                      )}
                      <time dateTime={shownAt.toISOString()}>{relativeTime(shownAt)}</time>
                      {isPublished && (
                        <Link
                          href={`/posts/${post.slug}`}
                          className="flex min-h-[24px] items-center gap-1 rounded-[var(--radius-sm)] text-[13px] font-medium text-[var(--primary-text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                        >
                          <ExternalLink size={12} strokeWidth={2} aria-hidden />
                          View<span className="sr-only"> {post.title}</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  {!isPublished && (
                    <p className="mt-2 line-clamp-2 text-[13px] leading-[1.5] text-[var(--muted-foreground)]">
                      {post.summary ?? post.bodyText}
                    </p>
                  )}

                  {post.status === PostStatus.IN_REVIEW && (
                    <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">
                      Waiting for an editor in your entity to review — usually within 24 hours.
                    </p>
                  )}

                  {post.status === PostStatus.SCHEDULED && post.scheduledAt && (
                    <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">
                      Scheduled to publish{" "}
                      <time dateTime={post.scheduledAt.toISOString()}>
                        {post.scheduledAt.toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      .
                    </p>
                  )}

                  {post.status === PostStatus.HIDDEN && post.hiddenReason && (
                    <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">
                      Hidden by a moderator: {post.hiddenReason}. You can appeal this decision — see
                      the{" "}
                      <Link
                        href="/legal/content-policy"
                        className="text-[var(--primary-text)] underline"
                      >
                        content policy
                      </Link>
                      .
                    </p>
                  )}

                  {post.status === PostStatus.REJECTED && (
                    <RejectedPostPanel
                      post={{
                        id: post.id,
                        title: post.title,
                        bodyJson: post.bodyJson,
                        linkUrl: post.linkUrl,
                        mediaUrl: mediaUrl(post.cover),
                        mediaAlt: post.cover?.altText ?? null,
                        rejectionReason: post.rejectionReason,
                      }}
                      richTextEnabled={richTextEnabled}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {published.length > 0 && (
        <section aria-label="Engagement summary" className="mt-8">
          <h2 className="mb-4 text-[16px] font-bold text-[var(--foreground)]">Engagement</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Total reactions" value={totalReactions} accent="primary" />
            <StatCard label="Total comments" value={totalComments} accent="success" />
          </div>
        </section>
      )}
    </main>
  );
}

type Accent = "primary" | "success" | "warning" | "muted";

const ACCENT_CLASS: Record<Accent, string> = {
  primary: "text-[var(--primary-text)]",
  success: "text-[var(--success-text)]",
  warning: "text-[var(--destructive-text)]",
  muted: "text-[var(--muted-foreground)]",
};

function StatCard({ label, value, accent }: { label: string; value: number; accent: Accent }) {
  return (
    <div className="aiesec-card px-5 py-4">
      <p className={`text-[28px] font-bold ${ACCENT_CLASS[accent]}`}>{value}</p>
      <p className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}
