import { Heart, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Tilt } from "@/components/motion/Parallax";
import { EntityName } from "@/components/ui/EntityName";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { TopicLabel } from "@/components/ui/TopicPill";
import { TopicPlate } from "@/components/ui/TopicPlate";
import { relativeTime } from "@/lib/relative-time";
import { tokensForKind } from "@/lib/topics-shared";
import type { FeedPost } from "@/types/feed";

/**
 * Tilt plate, the one exception to "no card grid". Whole plate is one
 * Link, not an overlay — `.pulse-tilt-layer`'s transform makes it a
 * containing block, so an ::after overlay would stop at the panel edge.
 * Topic is a label, not a nested link (invalid HTML, fights the link's
 * z-index). Width comes from the caller; only the internal skeleton is
 * fixed, so rows stay even at any width.
 */
export function SecondaryPostCard({ post }: { post: FeedPost }) {
  const primaryTopic = post.topics[0];
  // No topic → no topic colour; bar/plate fall back to neutral rather than
  // claiming a GENERAL filing.
  const barColor = primaryTopic ? tokensForKind(primaryTopic.kind).accent : "var(--hairline)";
  const publisher = post.author.entityName ?? post.author.fullName;

  return (
    <Tilt max={5} lift={12} className="h-full w-full">
      <Link
        href={`/posts/${post.slug}`}
        className="group/card relative flex h-full w-full flex-col overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-[var(--card)] shadow-[var(--elev-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        <span className="pulse-tilt-layer relative block h-[150px] shrink-0 overflow-hidden bg-[var(--ink)]">
          {post.mediaUrl ? (
            <Image
              src={post.mediaUrl}
              alt=""
              fill
              className="object-cover opacity-95 transition-transform duration-[calc(var(--dur-scene)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover/card:scale-[calc(1+0.05*var(--motion-travel))]"
              sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            />
          ) : (
            <TopicPlate entityName={publisher} kind={primaryTopic?.kind ?? null} />
          )}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ background: barColor }}
          />
        </span>

        <span
          className="pulse-tilt-layer flex flex-1 flex-col p-4 pb-[18px]"
          style={{ "--layer-z": "20px" } as React.CSSProperties}
        >
          {/* Row height is reserved even with no topic, so topicless posts don't sit shorter than their neighbours. */}
          <span className="mb-2.5 flex min-h-[16px] items-center gap-2">
            {primaryTopic && <TopicLabel name={primaryTopic.name} kind={primaryTopic.kind} />}
            <LevelBadge level={post.level} />
          </span>

          <span className="pulse-serif pulse-clamp-safe line-clamp-2 block min-h-[2.32em] break-words text-[22px] leading-[1.16] text-[color:var(--card-foreground)] transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] group-hover/card:text-[color:var(--primary-text)]">
            {post.title}
          </span>

          {/* Two lines, not one — entity name + timestamp on a single line
              truncated the publisher, the one fact that says whose story this is. */}
          <span className="mt-auto block pt-3.5">
            <span className="pulse-label pulse-label-tight block truncate">
              <EntityName name={publisher} className="normal-case tracking-[0.06em]" />
            </span>
            <span className="mt-1.5 flex items-center gap-3">
              <time
                dateTime={post.publishedAt.toISOString()}
                className="pulse-label pulse-label-tight normal-case tracking-[0.06em]"
              >
                {relativeTime(post.publishedAt)}
              </time>
              <span className="tabular ml-auto flex shrink-0 items-center gap-2.5 text-[12px] text-[color:var(--muted-foreground)]">
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
              </span>
            </span>
          </span>
        </span>
      </Link>
    </Tilt>
  );
}
