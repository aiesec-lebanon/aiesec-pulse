import { Heart, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { FollowTarget } from "@/app/generated/prisma/enums";
import { FollowButton } from "@/components/engagement/FollowButton";
import { NetworkField } from "@/components/motion/NetworkField";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { TopicChip } from "@/components/topics/TopicChip";
import { relativeTime } from "@/lib/relative-time";
import type { FeedPost } from "@/types/feed";

/**
 * The lead story, as one immersive frame rather than an image with a headline
 * parked underneath it.
 *
 * Link structure: the headline anchor carries `after:absolute after:inset-0`,
 * so the whole frame is clickable through one anchor — no duplicate
 * `aria-hidden` image link competing with it, and no nested anchors. The
 * controls that are their own destinations (topic chips, the entity follow
 * button) sit in a `relative z-10` row above that overlay.
 */
export function HeroPost({ post }: { post: FeedPost }) {
  const href = `/posts/${post.slug}`;

  return (
    <Reveal y={28} scale={0.985} as="article" className="group relative">
      <div className="pulse-media-frame relative aspect-[4/5] w-full overflow-hidden shadow-[var(--elev-3)] sm:aspect-[16/10] lg:aspect-[21/9]">
        {/* The cover drifts against the scroll inside a fixed frame — the
            parallax is bounded by the frame, so no edge is ever exposed. */}
        <Parallax depth={-56} scale={1.14} className="absolute inset-0">
          {post.mediaUrl ? (
            <Image
              src={post.mediaUrl}
              alt={post.mediaAlt ?? ""}
              fill
              priority
              className="pulse-media object-cover"
              sizes="100vw"
            />
          ) : (
            <div
              aria-hidden
              className="pulse-media relative h-full w-full bg-[color-mix(in_srgb,var(--ink)_92%,var(--primary))]"
            >
              {/* No cover: the network stands in for the missing image rather
                  than a grey box with a letter in it. It needs its own dark
                  ground — the scrim above assumes a photograph underneath, and
                  over a light fallback it reads as a rendering fault. */}
              <div className="absolute inset-0 opacity-90">
                <NetworkField density={200} intensity={1} />
              </div>
            </div>
          )}
        </Parallax>

        <span aria-hidden className="pulse-image-scrim" />

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:p-12">
          {/* A percentage of the frame, not a `ch` measure: `ch` resolves
              against *this* element's font-size (16px inherited), not the
              64px display size inside it, so `max-w-[24ch]` was capping the
              headline at ~190px and breaking "comments" across two lines. */}
          <div className="max-w-[88%] sm:max-w-[72%] lg:max-w-[54%]">
            {/* `break-words` matters: a title containing one long unbroken
                token (a slug, a URL) otherwise gets sliced mid-token by the
                clamp instead of wrapping. And no `block` alongside
                `line-clamp-3` — Tailwind's clamp needs `display:-webkit-box`,
                and `block` is emitted later, so it wins and the clamp silently
                stops working. */}
            <h2 className="pulse-display pulse-display-lg text-white">
              <Link
                href={href}
                className="line-clamp-3 break-words after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
              >
                {post.title}
              </Link>
            </h2>
          </div>

          <p className="mt-5 max-w-[62ch] line-clamp-2 text-[17px] leading-[1.6] text-white/80">
            {post.excerpt}
          </p>

          {/* The entity and read time drop below `sm`: at 390px the full rule
              wrapped onto a second line beginning with a bare separator. */}
          <p className="pulse-label mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-white/70">
            <span className="text-white/95">{post.author.fullName}</span>
            {post.author.entityName && (
              <>
                <span aria-hidden className="hidden sm:inline">
                  /
                </span>
                <span className="hidden sm:inline">{post.author.entityName}</span>
              </>
            )}
            <span aria-hidden>/</span>
            <time dateTime={post.publishedAt.toISOString()}>{relativeTime(post.publishedAt)}</time>
            <span aria-hidden className="hidden sm:inline">
              /
            </span>
            <span className="hidden sm:inline">{post.readingMinutes} min read</span>
          </p>
        </div>
      </div>

      {/* Below the frame: only the controls that are their own destinations,
          plus the counts. The author and entity are already named in the
          overlay, so repeating them here with an avatar was restating the
          frame rather than adding to it. */}
      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        {post.author.entityName && (
          <FollowButton
            targetType={FollowTarget.ENTITY}
            targetId={post.publisherEntityId}
            initialState={post.entityFollowState}
            label={post.author.entityName}
            compact
          />
        )}

        {post.topics.slice(0, 3).map((topic) => (
          <TopicChip key={topic.slug} slug={topic.slug} name={topic.name} />
        ))}

        <div className="tabular ml-auto flex shrink-0 items-center gap-4 text-[13px] text-[color:var(--muted-foreground)]">
          <span className="flex items-center gap-1.5">
            <Heart size={14} strokeWidth={2} aria-hidden />
            {post.reactionCount}
            <span className="sr-only"> reactions</span>
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle size={14} strokeWidth={2} aria-hidden />
            {post.commentCount}
            <span className="sr-only"> comments</span>
          </span>
        </div>
      </div>
    </Reveal>
  );
}
