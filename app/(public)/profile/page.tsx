import { ArrowUpRight, Heart, MessageCircle } from "lucide-react";
import Link from "next/link";

import { PostStatus } from "@/app/generated/prisma/enums";
import { Reveal } from "@/components/motion/Reveal";
import { RejectedPostPanel } from "@/components/profile/RejectedPostPanel";
import { StatusPill } from "@/components/ui/StatusPill";
import { listActiveTopics } from "@/lib/content/topics";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/feed";
import { isEnabled } from "@/lib/flags";
import { can } from "@/lib/rbac/can";
import { requireSession } from "@/lib/rbac/guards";
import { relativeTime } from "@/lib/relative-time";

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

  const [posts, entity, richTextEnabled, topics] = await Promise.all([
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
        topics: { select: { topicId: true } },
      },
    }),
    user.primaryEntityId
      ? db.entity.findUnique({ where: { id: user.primaryEntityId }, select: { name: true } })
      : Promise.resolve(null),
    isEnabled("posts.rich_text"),
    listActiveTopics(),
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
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-24">
      <header className="border-b border-[var(--hairline)] pb-10 pt-12 sm:pt-16">
        <Reveal y={16}>
          <p className="pulse-label">
            <Link
              href="/feed"
              className="pulse-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Feed
            </Link>
            <span aria-hidden className="px-2">
              /
            </span>
            <span className="text-[color:var(--foreground)]">Your posts</span>
          </p>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
            <div className="flex items-center gap-5">
              <span
                aria-hidden
                className="flex h-16 w-16 shrink-0 select-none items-center justify-center rounded-full bg-[var(--primary-fill)] text-[20px] font-bold text-[color:var(--primary-foreground)] shadow-[var(--elev-2)]"
              >
                {avatarInitials(user.fullName)}
              </span>
              <div>
                <h1 className="pulse-display pulse-display-md text-[color:var(--foreground)]">
                  {user.fullName}
                </h1>
                <p className="mt-2 text-[15px] text-[color:var(--muted-foreground)]">
                  {entity?.name ? `${entity.name} · ` : ""}Member since {memberSince}
                </p>
              </div>
            </div>

            {canPublish && (
              <div className="flex shrink-0 flex-wrap gap-3">
                <Link href="/posts/new" className="aiesec-btn-primary">
                  New post
                </Link>
                <Link href="/drafts" className="aiesec-btn-secondary">
                  Drafts
                </Link>
              </div>
            )}
          </div>
        </Reveal>
      </header>

      {/* One statistics row, not two. The page previously opened with a 4-up
          of post counts and then closed with a second 2-up of engagement
          counts, so the same reader question ("how is my publishing going?")
          was answered in two places in two shapes. */}
      <Reveal y={20} delay={80}>
        <dl className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 border-b border-[var(--hairline)] pb-10 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Published" value={published.length} accent="success" />
          <Stat label="In review" value={inReview.length} accent="warning" />
          <Stat label="Rejected" value={rejected.length} accent="muted" />
          <Stat label="Reactions" value={totalReactions} accent="primary" />
          <Stat label="Comments" value={totalComments} accent="primary" />
        </dl>
      </Reveal>

      <section aria-labelledby="profile-posts" className="mt-12">
        <h2 id="profile-posts" className="pulse-label mb-6">
          Your posts ({posts.length})
        </h2>

        {posts.length === 0 ? (
          <div className="pulse-plate px-8 py-14 text-center">
            <p className="mx-auto max-w-[40ch] text-[16px] leading-[1.6] text-[color:var(--muted-foreground)]">
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
              const shownAt = post.publishedAt ?? post.createdAt;
              const isPublished = post.status === PostStatus.PUBLISHED;

              return (
                <li key={post.id} className="pulse-plate pulse-plate-interactive p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <StatusPill status={post.status} className="mt-0.5" />

                    <div className="min-w-0 flex-1">
                      {isPublished ? (
                        <Link
                          href={`/posts/${post.slug}`}
                          className="text-[15px] font-bold leading-snug text-[color:var(--foreground)] transition-colors hover:text-[color:var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                        >
                          {post.title}
                        </Link>
                      ) : (
                        <p className="text-[15px] font-bold leading-snug text-[color:var(--foreground)]">
                          {post.title}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-3 text-[13px] text-[color:var(--muted-foreground)]">
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
                          className="flex min-h-[24px] items-center gap-1 rounded-[var(--radius-sm)] text-[13px] font-medium text-[color:var(--primary-text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                        >
                          View<span className="sr-only"> {post.title}</span>
                          <ArrowUpRight size={13} strokeWidth={2.5} aria-hidden />
                        </Link>
                      )}
                    </div>
                  </div>

                  {!isPublished && (
                    <p className="mt-2 line-clamp-2 text-[13px] leading-[1.5] text-[color:var(--muted-foreground)]">
                      {post.summary ?? post.bodyText}
                    </p>
                  )}

                  {post.status === PostStatus.IN_REVIEW && (
                    <p className="mt-2 text-[12px] text-[color:var(--muted-foreground)]">
                      Waiting for an editor in your entity to review — usually within 24 hours.
                    </p>
                  )}

                  {post.status === PostStatus.SCHEDULED && post.scheduledAt && (
                    <p className="mt-2 text-[12px] text-[color:var(--muted-foreground)]">
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
                    <p className="mt-2 text-[12px] text-[color:var(--muted-foreground)]">
                      Hidden by a moderator: {post.hiddenReason}. You can appeal this decision — see
                      the{" "}
                      <Link
                        href="/legal/content-policy"
                        className="pulse-link rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
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
                        topicIds: post.topics.map((t) => t.topicId),
                      }}
                      richTextEnabled={richTextEnabled}
                      topics={topics}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

type Accent = "primary" | "success" | "warning" | "muted";

const ACCENT_CLASS: Record<Accent, string> = {
  primary: "text-[color:var(--primary-text)]",
  success: "text-[color:var(--success-text)]",
  warning: "text-[color:var(--destructive-text)]",
  muted: "text-[color:var(--muted-foreground)]",
};

/**
 * Figures on the page's own ground rather than in five boxes. Five bordered
 * tiles in a row is the hero-metric template, and it made a set of small
 * counts look like the most important thing on a page about posts.
 */
function Stat({ label, value, accent }: { label: string; value: number; accent: Accent }) {
  return (
    <div>
      <dd className={`tabular text-[34px] font-black leading-none ${ACCENT_CLASS[accent]}`}>
        {value}
      </dd>
      <dt className="pulse-label mt-3">{label}</dt>
    </div>
  );
}
