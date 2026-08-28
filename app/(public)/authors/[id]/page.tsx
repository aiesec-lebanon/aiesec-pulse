import { notFound } from "next/navigation";

import { FollowTarget } from "@/app/generated/prisma/enums";
import { FollowButton } from "@/components/engagement/FollowButton";
import { SidebarPostItem } from "@/components/feed/SidebarPostItem";
import { Reveal } from "@/components/motion/Reveal";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileIndexRail, type ProfileSection } from "@/components/profile/ProfileIndexRail";
import { PublishedIndexRow } from "@/components/profile/PublishedIndexRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import {
  getAuthorPostCount,
  getAuthorPosts,
  getAuthorReactionTotal,
  getEntityPosts,
  PROFILE_PAGE_SIZE,
} from "@/lib/feed";
import { getAuthorProfile } from "@/lib/profile";
import { requireSession } from "@/lib/rbac/guards";
import { initialsOf } from "@/lib/topics-shared";

const ELSEWHERE_TAKE = 3;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getAuthorProfile(id);
  if (!profile) return { title: "Member not found" };
  return { title: `${profile.fullName} · AIESEC Pulse` };
}

/**
 * A member's public page — UI ref **4a**, sharing its whole composition with
 * `/profile`: angled initials hero, stat strip, sticky section index beside
 * one reading column, and the numbered "Published" index whose rows grow a
 * rule and arrow on hover.
 *
 * What 4a shows that this can't: an overview paragraph, a pull-quote, and
 * three "recognition" cards — `User` has no bio, quote, or award field, so
 * they're dropped rather than faked (§0's Trust row). The standfirst uses
 * real fields instead: where they publish from, since when.
 *
 * "Elsewhere in {entity}" is 4a's closing section and *is* real: recent posts
 * from the same office by other members.
 */
export default async function AuthorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const viewer = await requireSession();

  const profile = await getAuthorProfile(id);
  if (!profile) return notFound();

  const [{ posts, hasNext }, postCount, reactionTotal, entityFeed] = await Promise.all([
    getAuthorPosts(id, page),
    getAuthorPostCount(id),
    getAuthorReactionTotal(id),
    profile.primaryEntity
      ? getEntityPosts(profile.primaryEntity.id, 1)
      : Promise.resolve({ posts: [], hasNext: false }),
  ]);

  const isSelf = viewer.id === id;
  const sinceYear = profile.onPulseSince.getFullYear();
  const entityName = profile.primaryEntity?.name ?? null;

  // The office's own recent publishing, minus this member's — "elsewhere"
  // means elsewhere.
  const elsewhere = entityFeed.posts
    .filter((post) => post.author.id !== id)
    .slice(0, ELSEWHERE_TAKE);

  const sections: ProfileSection[] = [
    { id: "author-published", label: `Published (${postCount})` },
    ...(elsewhere.length > 0 ? [{ id: "author-elsewhere", label: "Elsewhere" }] : []),
  ];

  const hasRail = sections.length >= 2;

  return (
    <main className="flex-1 pb-24">
      <ProfileHero
        kicker="Author"
        initials={initialsOf(profile.fullName)}
        name={profile.fullName}
        positionTitle={profile.positionTitle}
        entityName={entityName}
        // The member's own words when they have written any; otherwise the
        // factual line a query can always answer. Never a plausible-sounding
        // sentence about someone who did not write it.
        standfirst={
          profile.bio ??
          (entityName
            ? `Publishing from ${entityName} since ${sinceYear}.`
            : `On Pulse since ${sinceYear}.`)
        }
        specLabel={`${profile.fullName} totals`}
        specCells={[
          { label: "Posts published", value: <span className="tabular">{postCount}</span> },
          { label: "Reactions", value: <span className="tabular">{reactionTotal}</span> },
          { label: "Followers", value: <span className="tabular">{profile.followerCount}</span> },
          { label: "On Pulse since", value: <span className="tabular">{sinceYear}</span> },
        ]}
        actions={
          isSelf ? undefined : (
            <FollowButton
              targetType={FollowTarget.USER}
              targetId={profile.id}
              initialState={profile.viewerFollowState}
              label={profile.fullName}
              variant="prominent"
            />
          )
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
            <ProfileIndexRail sections={sections} />
          </aside>
        )}

        <div className="min-w-0 max-w-[860px]">
          <Reveal as="section" y={20}>
            <div id="author-published" className="scroll-mt-[calc(var(--rail-h)+40px)]">
              <h2 className="mb-1 text-[24px] font-bold leading-[1.2] tracking-[-0.01em] text-[color:var(--foreground)]">
                Published
              </h2>
            </div>

            {posts.length === 0 ? (
              <EmptyState
                eyebrow="Nothing published"
                heading={`Nothing published by ${profile.fullName} yet.`}
                body="When they publish something you can see, it will appear here."
              />
            ) : (
              <div className="mt-4 flex flex-col border-t border-[var(--hairline)]">
                {posts.map((post, i) => (
                  <PublishedIndexRow
                    key={post.id}
                    index={(page - 1) * PROFILE_PAGE_SIZE + i + 1}
                    href={`/posts/${post.slug}`}
                    title={post.title}
                    topic={post.topics[0] ?? null}
                    at={post.publishedAt}
                  />
                ))}
              </div>
            )}
          </Reveal>

          {elsewhere.length > 0 && entityName && (
            <Reveal as="section" y={20} className="mt-16 border-t border-[var(--hairline)] pt-10">
              <div id="author-elsewhere" className="scroll-mt-[calc(var(--rail-h)+40px)]">
                <h2 className="mb-4 text-[24px] font-bold leading-[1.2] tracking-[-0.01em] text-[color:var(--foreground)]">
                  Elsewhere in {entityName}
                </h2>
              </div>
              {elsewhere.map((post, i) => (
                <SidebarPostItem key={post.id} post={post} index={i + 1} />
              ))}
            </Reveal>
          )}

          <Pagination
            label="Author pagination"
            page={page}
            hasNext={hasNext}
            previousHref={
              page > 1 ? (page === 2 ? `/authors/${id}` : `/authors/${id}?page=${page - 1}`) : null
            }
            nextHref={`/authors/${id}?page=${page + 1}`}
          />
        </div>
      </div>
    </main>
  );
}
