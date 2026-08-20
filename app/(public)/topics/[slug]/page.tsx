import Link from "next/link";
import { notFound } from "next/navigation";

import { type FollowState } from "@/app/actions/follows";
import { FollowTarget } from "@/app/generated/prisma/enums";
import { FollowButton } from "@/components/engagement/FollowButton";
import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { db } from "@/lib/db";
import { getTopicFeed } from "@/lib/feed";
import { requireSession } from "@/lib/rbac/guards";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = await db.topic.findUnique({
    where: { slug },
    select: { name: true, isActive: true },
  });
  if (!topic || !topic.isActive) return { title: "Topic not found" };
  return { title: `${topic.name} · AIESEC Pulse` };
}

export default async function TopicArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const user = await requireSession();

  // Same visibility rule as the main feed: an inactive topic isn't a valid
  // browsing destination even if a stale link to it still exists.
  const topic = await db.topic.findUnique({
    where: { slug },
    select: { id: true, name: true, description: true, isActive: true },
  });
  if (!topic || !topic.isActive) return notFound();

  const [{ posts, hasNext }, follow] = await Promise.all([
    getTopicFeed(topic.id, page),
    db.follow.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: user.id,
          targetType: FollowTarget.TOPIC,
          targetId: topic.id,
        },
      },
      select: { muted: true },
    }),
  ]);
  const followState: FollowState = follow ? (follow.muted ? "muted" : "following") : "none";

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-24">
      <header className="border-b border-[var(--hairline)] pb-8 pt-12 sm:pt-16">
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
            <span className="text-[color:var(--foreground)]">Topic</span>
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <h1 className="pulse-display pulse-display-md text-[color:var(--foreground)]">
              {topic.name}
            </h1>
            <FollowButton
              targetType={FollowTarget.TOPIC}
              targetId={topic.id}
              initialState={followState}
              label={topic.name}
            />
          </div>

          {topic.description && (
            <p className="mt-4 max-w-[62ch] text-[17px] leading-[1.6] text-[color:var(--muted-foreground)]">
              {topic.description}
            </p>
          )}
        </Reveal>
      </header>

      {posts.length === 0 ? (
        <EmptyState
          heading={`Nothing tagged ${topic.name} yet.`}
          body="When a post is tagged with this topic, it will appear here."
        />
      ) : (
        <section aria-label={`Posts about ${topic.name}`} className="mt-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <Reveal key={post.id} y={28} delay={(i % 3) * 80} className="h-full">
                <SecondaryPostCard post={post} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <Pagination
        label="Topic pagination"
        page={page}
        hasNext={hasNext}
        previousHref={
          page > 1 ? (page === 2 ? `/topics/${slug}` : `/topics/${slug}?page=${page - 1}`) : null
        }
        nextHref={`/topics/${slug}?page=${page + 1}`}
      />
    </main>
  );
}
