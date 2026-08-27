import { notFound } from "next/navigation";

import { type FollowState } from "@/app/actions/follows";
import { FollowTarget } from "@/app/generated/prisma/enums";
import { FollowButton } from "@/components/engagement/FollowButton";
import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SpecStrip } from "@/components/ui/SpecStrip";
import { TextTabs } from "@/components/ui/TextTabs";
import { db } from "@/lib/db";
import { getTopicFeed, getTopicStats, type TopicSort } from "@/lib/feed";
import { requireSession } from "@/lib/rbac/guards";
import { initialsOf, tokensForKind } from "@/lib/topics-shared";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = await db.topic.findUnique({
    where: { slug },
    select: { name: true, isActive: true },
  });
  if (!topic || !topic.isActive) return { title: "Topic not found" };
  return { title: `${topic.name} · AIESEC Pulse` };
}

function hrefFor(slug: string, page: number, sort: TopicSort): string {
  const qs = new URLSearchParams();
  if (sort !== "recent") qs.set("sort", sort);
  if (page > 1) qs.set("page", String(page));
  const query = qs.toString();
  return query ? `/topics/${slug}?${query}` : `/topics/${slug}`;
}

export default async function TopicArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam, sort: sortParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const sort: TopicSort = sortParam === "popular" ? "popular" : "recent";
  const user = await requireSession();

  // Same visibility rule as the main feed: an inactive topic isn't a valid
  // browsing destination even if a stale link to it still exists.
  const topic = await db.topic.findUnique({
    where: { slug },
    select: { id: true, name: true, description: true, isActive: true, kind: true },
  });
  if (!topic || !topic.isActive) return notFound();

  const [{ posts, hasNext }, follow, stats] = await Promise.all([
    getTopicFeed(topic.id, page, sort),
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
    getTopicStats(topic.id),
  ]);
  const followState: FollowState = follow ? (follow.muted ? "muted" : "following") : "none";
  const tokens = tokensForKind(topic.kind);

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-24">
      <div className="relative overflow-hidden">
        <Parallax
          depth={24}
          className="pointer-events-none absolute right-0 top-0 z-0 hidden select-none sm:block"
        >
          <span
            aria-hidden
            className="pulse-serif block leading-none"
            style={{
              fontSize: "clamp(120px,20vw,260px)",
              color: `color-mix(in srgb, ${tokens.accent} 14%, transparent)`,
            }}
          >
            {initialsOf(topic.name)}
          </span>
        </Parallax>

        <div className="relative z-10">
          <PageHeader
            breadcrumb={[{ href: "/feed", label: "Feed" }, { label: "Topic" }]}
            title={topic.name}
            standfirst={topic.description ?? undefined}
            actions={
              <FollowButton
                targetType={FollowTarget.TOPIC}
                targetId={topic.id}
                initialState={followState}
                label={topic.name}
              />
            }
            bordered={false}
          />
        </div>
      </div>

      <SpecStrip
        ariaLabel={`${topic.name} totals`}
        cells={[
          { label: "Posts", value: <span className="tabular">{stats.postCount}</span> },
          {
            label: "Contributing entities",
            value: <span className="tabular">{stats.entityCount}</span>,
          },
          { label: "Followers", value: <span className="tabular">{stats.followerCount}</span> },
          {
            label: "Avg. read",
            value: stats.avgReadingMinutes > 0 ? `${stats.avgReadingMinutes} min` : "—",
          },
        ]}
      />

      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <TextTabs
          ariaLabel="Sort"
          items={[
            { href: hrefFor(slug, 1, "recent"), label: "Recent", isActive: sort === "recent" },
            { href: hrefFor(slug, 1, "popular"), label: "Popular", isActive: sort === "popular" },
          ]}
        />
      </div>

      {posts.length === 0 ? (
        <EmptyState
          heading={`Nothing tagged ${topic.name} yet.`}
          body="When a post is tagged with this topic, it will appear here."
        />
      ) : (
        <section aria-label={`Posts about ${topic.name}`} className="mt-10">
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
        previousHref={page > 1 ? hrefFor(slug, page - 1, sort) : null}
        nextHref={hrefFor(slug, page + 1, sort)}
      />
    </main>
  );
}
