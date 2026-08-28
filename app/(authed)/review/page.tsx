import { PostStatus } from "@/app/generated/prisma/enums";
import { QueueCard } from "@/components/moderation/QueueCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SpecStrip } from "@/components/ui/SpecStrip";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/feed";
import { getQueueStats } from "@/lib/moderation";
import { entityDisplayName } from "@/lib/org/display";
import { requirePermission } from "@/lib/rbac/guards";
import { postScopeWhere, resolveScopeFilter } from "@/lib/rbac/scope-filter";

export const dynamic = "force-dynamic";

export const metadata = { title: "Review queue · AIESEC Pulse" };

/**
 * The approval queue, at `/review`.
 *
 * It used to live at `/admin/queue`, wrong on both counts: this is editorial
 * work by an AIESEC position inside its own entity, not administration, and
 * it was never reachable by a platform administrator anyway —
 * `requirePermission("post.approve")` requires a *member* session, so a
 * credential admin opening `/admin/queue` was redirected straight back to
 * member sign-in. A URL promising administration but gating a different
 * identity broke its promise to both audiences; `/admin/*` now is what it
 * says it is.
 */
export default async function ReviewQueuePage() {
  const user = await requirePermission("post.approve");
  const scope = await resolveScopeFilter(user, "post.approve");

  const [posts, stats] = await Promise.all([
    db.post.findMany({
      where: { status: PostStatus.IN_REVIEW, ...postScopeWhere(scope) },
      orderBy: { createdAt: "asc" }, // oldest first — the queue is a queue
      take: 100,
      select: {
        id: true,
        title: true,
        bodyText: true,
        linkUrl: true,
        createdAt: true,
        cover: { select: { bucket: true, path: true, altText: true } },
        author: { select: { fullName: true } },
        publisher: { select: { name: true, kind: true } },
        topics: { select: { topic: { select: { name: true, kind: true } } }, take: 1 },
      },
    }),
    getQueueStats(scope),
  ]);

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 pb-24 pt-8 sm:px-6">
      <PageHeader
        breadcrumb={[{ href: "/feed", label: "Feed" }, { label: "Review" }]}
        title="Approval queue"
        standfirst="Posts submitted beyond their author's weekly allowance. Rejecting never destroys the post — the author sees your reason and can edit and resubmit."
        count={posts.length}
        countLabel="pending"
      />

      <SpecStrip
        ariaLabel="Moderation totals"
        className="mt-10"
        cells={[
          { label: "Pending", value: <span className="tabular">{posts.length}</span> },
          {
            label: "Approved today",
            value: <span className="tabular">{stats.approvedToday}</span>,
          },
          {
            label: "Rejected today",
            value: <span className="tabular">{stats.rejectedToday}</span>,
          },
          {
            label: "Avg. review time",
            value: stats.avgReviewMinutes !== null ? `${stats.avgReviewMinutes} min` : "—",
          },
        ]}
      />

      {posts.length === 0 ? (
        <EmptyState
          heading="Queue clear."
          body="Nothing left to review. New submissions will land back in this list once an author goes over their allowance."
        />
      ) : (
        <div className="mt-10 flex flex-col">
          {posts.map((post) => {
            const primaryTopic = post.topics[0]?.topic ?? null;
            return (
              <QueueCard
                key={post.id}
                postId={post.id}
                authorName={post.author.fullName}
                authorEntity={
                  entityDisplayName(post.publisher.name, post.publisher.kind) ?? post.publisher.name
                }
                submittedAt={post.createdAt.toISOString()}
                title={post.title}
                content={post.bodyText}
                mediaUrl={mediaUrl(post.cover)}
                mediaAlt={post.cover?.altText ?? null}
                linkUrl={post.linkUrl}
                topicName={primaryTopic?.name ?? null}
                topicKind={primaryTopic?.kind ?? null}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
