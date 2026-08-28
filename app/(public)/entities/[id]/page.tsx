import Link from "next/link";
import { notFound } from "next/navigation";

import { FollowTarget } from "@/app/generated/prisma/enums";
import { FollowButton } from "@/components/engagement/FollowButton";
import { Reveal } from "@/components/motion/Reveal";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileIndexRail, type ProfileSection } from "@/components/profile/ProfileIndexRail";
import { PublishedIndexRow } from "@/components/profile/PublishedIndexRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { getEntityPostCount, getEntityPosts, PROFILE_PAGE_SIZE } from "@/lib/feed";
import { getEntityProfile } from "@/lib/profile";
import { initialsOf } from "@/lib/topics-shared";

const KIND_LABEL: Record<"GLOBAL" | "REGION" | "MC" | "LC", string> = {
  GLOBAL: "Global office",
  REGION: "Region",
  MC: "Member Committee",
  LC: "Local Committee",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entity = await getEntityProfile(id);
  if (!entity) return { title: "Entity not found" };
  return { title: `${entity.name} · AIESEC Pulse` };
}

/**
 * An office's page.
 *
 * `entity.name` already arrives as the brand lockup (`lib/profile.ts` via
 * `entityDisplayName`) — do not prepend "AIESEC in" again here.
 *
 * `Entity` has no field for an overview paragraph or MC-president pull-quote,
 * so both are dropped rather than faked.
 */
export default async function EntityProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const entity = await getEntityProfile(id);
  if (!entity) return notFound();

  const [{ posts, hasNext }, postCount] = await Promise.all([
    getEntityPosts(id, page),
    getEntityPostCount(id),
  ]);

  const sections: ProfileSection[] = [
    { id: "entity-published", label: `Published (${postCount})` },
    ...(entity.children.length > 0
      ? [{ id: "entity-children", label: `Local committees (${entity.children.length})` }]
      : []),
  ];

  const hasRail = sections.length >= 2;

  return (
    <main className="flex-1 pb-24">
      <ProfileHero
        kicker="Entity"
        initials={initialsOf(entity.name)}
        name={entity.name}
        positionTitle={KIND_LABEL[entity.kind]}
        standfirst={
          entity.children.length > 0
            ? `${entity.memberCount} members across ${entity.children.length} local ${entity.children.length === 1 ? "committee" : "committees"}.`
            : `${entity.memberCount} ${entity.memberCount === 1 ? "member" : "members"} on Pulse.`
        }
        accent="var(--topic-function)"
        specLabel={`${entity.name} totals`}
        specCells={[
          { label: "Posts published", value: <span className="tabular">{postCount}</span> },
          { label: "Members", value: <span className="tabular">{entity.memberCount}</span> },
          {
            label: "Local committees",
            value: <span className="tabular">{entity.children.length}</span>,
          },
          { label: "Followers", value: <span className="tabular">{entity.followerCount}</span> },
        ]}
        actions={
          <FollowButton
            targetType={FollowTarget.ENTITY}
            targetId={entity.id}
            initialState={entity.viewerFollowState}
            label={entity.name}
            variant="prominent"
          />
        }
      />

      <div
        className={[
          "mx-auto w-full max-w-[1240px] px-6 pt-14",
          hasRail ? "grid grid-cols-1 items-start gap-12 lg:grid-cols-[230px_minmax(0,1fr)]" : "",
        ].join(" ")}
      >
        {hasRail && (
          <aside className="pulse-sticky-rail hidden lg:block">
            <ProfileIndexRail sections={sections} label="On this page" />
          </aside>
        )}

        <div className="min-w-0 max-w-[860px]">
          <Reveal as="section" y={20}>
            <div id="entity-published" className="scroll-mt-[calc(var(--rail-h)+40px)]">
              <h2 className="mb-1 text-[24px] font-bold leading-[1.2] tracking-[-0.01em] text-[color:var(--foreground)]">
                Published
              </h2>
            </div>

            {posts.length === 0 ? (
              <EmptyState
                eyebrow="Nothing published"
                heading={`Nothing published by ${entity.name} yet.`}
                body="When this office publishes something you can see, it will appear here."
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

          {entity.children.length > 0 && (
            <Reveal as="section" y={20} className="mt-16 border-t border-[var(--hairline)] pt-10">
              <div id="entity-children" className="scroll-mt-[calc(var(--rail-h)+40px)]">
                <h2 className="mb-4 text-[24px] font-bold leading-[1.2] tracking-[-0.01em] text-[color:var(--foreground)]">
                  Local committees
                </h2>
              </div>
              <ul className="flex flex-col border-t border-[var(--hairline)]">
                {entity.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/entities/${child.id}`}
                      className="group relative flex items-center justify-between gap-4 border-b border-[var(--hairline)] py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-x-0 bottom-[-1px] h-px origin-left scale-x-0 bg-[var(--primary)] transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:scale-x-100 group-focus-visible:scale-x-100"
                      />
                      <span className="truncate text-[15px] font-bold text-[color:var(--foreground)] transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] group-hover:text-[color:var(--primary-text)]">
                        {child.name}
                      </span>
                      <span className="pulse-label shrink-0">{child.memberCount} members</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          <Pagination
            label="Entity pagination"
            page={page}
            hasNext={hasNext}
            previousHref={
              page > 1
                ? page === 2
                  ? `/entities/${id}`
                  : `/entities/${id}?page=${page - 1}`
                : null
            }
            nextHref={`/entities/${id}?page=${page + 1}`}
          />
        </div>
      </div>
    </main>
  );
}
