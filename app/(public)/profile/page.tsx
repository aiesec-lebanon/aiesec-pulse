import Link from "next/link";

import { PostStatus } from "@/app/generated/prisma/enums";
import { Reveal } from "@/components/motion/Reveal";
import { BioEditor } from "@/components/profile/BioEditor";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileIndexRail, type ProfileSection } from "@/components/profile/ProfileIndexRail";
import { PublishedIndexRow } from "@/components/profile/PublishedIndexRow";
import { RejectedPostPanel } from "@/components/profile/RejectedPostPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { listActiveTopics } from "@/lib/content/topics";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/feed";
import { isEnabled } from "@/lib/flags";
import { getAuthorProfile } from "@/lib/profile";
import { can } from "@/lib/rbac/can";
import { requireSession } from "@/lib/rbac/guards";
import { initialsOf } from "@/lib/topics-shared";

export const metadata = { title: "Your posts · AIESEC Pulse" };

/**
 * The member's own page, built on UI ref **4a**'s composition: angled
 * initials hero, four-cell stat strip, sticky section index beside a single
 * reading column.
 *
 * It's 4a's *layout*, not its content — this page answers a different
 * question than a public author profile: not "what has this person
 * published?" but "what is happening to everything I wrote?". So the index
 * tracks lifecycle sections — published, waiting, needs another look — and
 * numbered rows are reserved for posts that are actually live and therefore
 * linkable. A rejected post isn't a destination but a task, so it keeps its
 * editing panel.
 *
 * 4a's overview paragraph, pull-quote, and "recognition" cards are dropped,
 * not invented: `User` carries no bio, quote, or award field. The standfirst
 * is a factual line assembled from what a query can answer.
 */
export default async function ProfilePage() {
  const user = await requireSession();
  const canPublish = await can(user, "post.publish");

  const [posts, profile, richTextEnabled, topics] = await Promise.all([
    db.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        titleAccent: true,
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
        topics: { select: { topicId: true, topic: { select: { name: true, kind: true } } } },
      },
    }),
    // The viewer's own author profile: position title, entity (already the
    // brand lockup), follower count, and when they joined. Reused rather than
    // re-queried so the two profile surfaces cannot disagree about a member.
    getAuthorProfile(user.id),
    isEnabled("posts.rich_text"),
    listActiveTopics(),
  ]);

  const published = posts.filter((p) => p.status === PostStatus.PUBLISHED);
  const waiting = posts.filter(
    (p) => p.status === PostStatus.IN_REVIEW || p.status === PostStatus.SCHEDULED
  );
  const attention = posts.filter(
    (p) => p.status === PostStatus.REJECTED || p.status === PostStatus.HIDDEN
  );
  const totalReactions = posts.reduce((sum, p) => sum + p.reactionCount, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.commentCount, 0);

  const memberSinceYear = user.createdAt.getFullYear();
  const entityName = profile?.primaryEntity?.name ?? null;

  const sections: ProfileSection[] = [
    published.length > 0
      ? { id: "profile-published", label: `Published (${published.length})` }
      : null,
    waiting.length > 0 ? { id: "profile-waiting", label: `Waiting (${waiting.length})` } : null,
    attention.length > 0
      ? { id: "profile-attention", label: `Needs a look (${attention.length})` }
      : null,
  ].filter((section): section is ProfileSection => section !== null);

  const hasRail = sections.length >= 2;

  return (
    <main className="flex-1 pb-24">
      <ProfileHero
        kicker="You"
        initials={initialsOf(user.fullName)}
        name={user.fullName}
        positionTitle={profile?.positionTitle ?? null}
        entityName={entityName}
        standfirstSlot={<BioEditor initialBio={profile?.bio ?? null} />}
        specLabel="Your publishing totals"
        specCells={[
          { label: "Published", value: <span className="tabular">{published.length}</span> },
          { label: "Reactions", value: <span className="tabular">{totalReactions}</span> },
          { label: "Comments", value: <span className="tabular">{totalComments}</span> },
          { label: "On Pulse since", value: <span className="tabular">{memberSinceYear}</span> },
        ]}
        actions={
          canPublish ? (
            <>
              <Link href="/posts/new" className="pulse-action">
                New post
              </Link>
              <Link
                href="/drafts"
                className="pulse-label inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--hairline)] px-5 text-[color:var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[color:var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                Drafts
              </Link>
            </>
          ) : undefined
        }
      />

      {/* The rail only earns its column with more than one section to track
          (`ProfileIndexRail` renders nothing below that) — without the
          condition, a single-section profile left a blank 230px gutter,
          pushing its only content a third of the way across the page. */}
      <div
        className={[
          "mx-auto w-full max-w-[1240px] px-6 pt-14",
          hasRail ? "grid grid-cols-1 items-start gap-12 lg:grid-cols-[230px_minmax(0,1fr)]" : "",
        ].join(" ")}
      >
        {hasRail && (
          <aside className="pulse-sticky-rail hidden lg:block">
            <ProfileIndexRail sections={sections} label="On this profile" />
          </aside>
        )}

        <div className="min-w-0 max-w-[860px]">
          {posts.length === 0 ? (
            <EmptyState
              eyebrow="Nothing yet"
              heading="You haven't published anything yet."
              accentWord="published"
              body={
                canPublish
                  ? "Write your first update and it will appear here the moment it goes out."
                  : "Publishing is available to entity publishers and editors. Ask an editor in your entity if you would like to write."
              }
              action={
                canPublish ? { href: "/posts/new", label: "Write your first update" } : undefined
              }
            />
          ) : (
            <>
              {published.length > 0 && (
                <Section id="profile-published" heading="Published">
                  {published.map((post, i) => (
                    <PublishedIndexRow
                      key={post.id}
                      index={i + 1}
                      href={`/posts/${post.slug}`}
                      title={post.title}
                      topic={post.topics[0]?.topic ?? null}
                      at={post.publishedAt ?? post.createdAt}
                    />
                  ))}
                </Section>
              )}

              {waiting.length > 0 && (
                <Section id="profile-waiting" heading="Waiting">
                  {waiting.map((post) => (
                    <PendingRow key={post.id} status={post.status} title={post.title}>
                      {post.status === PostStatus.IN_REVIEW && (
                        <>
                          Waiting for an editor in your entity to review — usually within 24 hours.
                        </>
                      )}
                      {post.status === PostStatus.SCHEDULED && post.scheduledAt && (
                        <>
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
                        </>
                      )}
                    </PendingRow>
                  ))}
                </Section>
              )}

              {attention.length > 0 && (
                <Section id="profile-attention" heading="Needs a look">
                  {attention.map((post) => (
                    <PendingRow key={post.id} status={post.status} title={post.title}>
                      {post.status === PostStatus.HIDDEN && post.hiddenReason && (
                        <>
                          Hidden by a moderator: {post.hiddenReason}. You can appeal this decision —
                          see the{" "}
                          <Link
                            href="/legal/content-policy"
                            className="pulse-link rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                          >
                            content policy
                          </Link>
                          .
                        </>
                      )}
                      {post.status === PostStatus.REJECTED && (
                        <RejectedPostPanel
                          post={{
                            id: post.id,
                            title: post.title,
                            titleAccent: post.titleAccent,
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
                    </PendingRow>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Section({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal as="section" y={20} className="mt-14 first:mt-0">
      {/* `scroll-mt` clears the sticky rail when the index jumps here. */}
      <div id={id} className="scroll-mt-[calc(var(--rail-h)+40px)]">
        <h2 className="mb-1 text-[24px] font-bold leading-[1.2] tracking-[-0.01em] text-[color:var(--foreground)]">
          {heading}
        </h2>
      </div>
      <div className="mt-4 flex flex-col border-t border-[var(--hairline)]">{children}</div>
    </Reveal>
  );
}

/** A post that is not live, so not a link: a status, a headline, and why. */
function PendingRow({
  status,
  title,
  children,
}: {
  status: PostStatus;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--hairline)] py-6">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <StatusPill status={status} className="mt-1 shrink-0" />
        <p className="pulse-serif min-w-0 flex-1 break-words text-[22px] leading-[1.2] text-[color:var(--foreground)]">
          {title}
        </p>
      </div>
      {children && (
        <div className="mt-3 text-[14px] leading-[1.6] text-[color:var(--muted-foreground)]">
          {children}
        </div>
      )}
    </div>
  );
}
