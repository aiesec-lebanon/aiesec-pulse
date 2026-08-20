import { Heart, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Tilt } from "@/components/motion/Parallax";
import { TopicChip } from "@/components/topics/TopicChip";
import { relativeTime } from "@/lib/relative-time";
import type { FeedPost } from "@/types/feed";

/**
 * The standard story card, on a 3-D plate.
 *
 * The card is a real plate in space: the pointer tilts it against a 1200px
 * perspective, the title and counts sit on lifted z-layers above its surface,
 * and a pointer-tracked sheen crosses it. All of that multiplies by
 * `--motion-travel`, so under Reduced the plate simply lies flat and the card
 * behaves exactly as it did before.
 *
 * The card link uses an `::after` overlay rather than wrapping the article, so
 * the topic chips underneath can stay real links without nesting anchors.
 */
export function SecondaryPostCard({ post }: { post: FeedPost }) {
  return (
    <div className="group flex h-full flex-col gap-3">
      <Tilt max={4.5} lift={10} className="flex-1">
        <article className="pulse-plate pulse-plate-interactive relative flex h-full flex-col overflow-hidden">
          <div className="pulse-media-frame relative aspect-[16/10] rounded-none">
            {post.mediaUrl ? (
              <Image
                src={post.mediaUrl}
                alt=""
                fill
                className="pulse-media object-cover"
                sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
              />
            ) : (
              <div
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(140deg,color-mix(in_srgb,var(--primary)_26%,var(--card)),color-mix(in_srgb,var(--success)_18%,var(--card))_55%,var(--card))]"
              />
            )}
          </div>

          <div
            className="pulse-tilt-layer flex flex-1 flex-col p-5"
            style={{ "--layer-z": "18px" } as React.CSSProperties}
          >
            {/* The clamp sits on the anchor, not the heading: as an inline
                child of a clamped heading the anchor's own box was 23px tall,
                under the 24px target floor (WCAG 2.5.8) even though its
                ::after overlay covers the whole card. As a block it fills the
                heading and measures what it actually targets. */}
            <h3 className="text-[20px] font-bold leading-[1.3] tracking-[-0.01em] text-[color:var(--card-foreground)]">
              <Link
                href={`/posts/${post.slug}`}
                className="line-clamp-3 break-words after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                {post.title}
              </Link>
            </h3>

            <p className="pulse-label mt-auto pt-5 text-[10px]">
              <span className="block truncate normal-case tracking-[0.06em]">
                {post.author.entityName ?? post.author.fullName}
              </span>
            </p>

            <div className="tabular mt-2.5 flex items-center gap-3 text-[13px] text-[color:var(--muted-foreground)]">
              <time dateTime={post.publishedAt.toISOString()}>
                {relativeTime(post.publishedAt)}
              </time>
              <span className="ml-auto flex items-center gap-1.5">
                <Heart size={13} strokeWidth={2} aria-hidden />
                {post.reactionCount}
                <span className="sr-only"> reactions</span>
              </span>
              <span className="flex items-center gap-1.5">
                <MessageCircle size={13} strokeWidth={2} aria-hidden />
                {post.commentCount}
                <span className="sr-only"> comments</span>
              </span>
            </div>
          </div>
        </article>
      </Tilt>

      {post.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.topics.slice(0, 2).map((topic) => (
            <TopicChip key={topic.slug} slug={topic.slug} name={topic.name} />
          ))}
        </div>
      )}
    </div>
  );
}
