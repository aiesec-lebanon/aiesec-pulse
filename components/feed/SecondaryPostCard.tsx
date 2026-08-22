import Image from "next/image";
import Link from "next/link";

import { Tilt } from "@/components/motion/Parallax";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { TopicLabel } from "@/components/ui/TopicPill";
import { TopicPlate } from "@/components/ui/TopicPlate";
import { relativeTime } from "@/lib/relative-time";
import { tokensForKind } from "@/lib/topics-shared";
import type { FeedPost } from "@/types/feed";

export function SecondaryPostCard({ post }: { post: FeedPost }) {
  const primaryTopic = post.topics[0];
  const primaryKind = primaryTopic?.kind ?? "GENERAL";
  const barColor = tokensForKind(primaryKind).accent;

  return (
    <Tilt max={5} lift={12} className="w-[260px] shrink-0 snap-start">
      <article className="relative flex h-full flex-col overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-[var(--card)] shadow-[var(--elev-2)]">
        <div className="pulse-tilt-layer relative h-[150px] overflow-hidden bg-[#0b0e13]">
          {post.mediaUrl ? (
            <Image
              src={post.mediaUrl}
              alt=""
              fill
              className="object-cover opacity-95"
              sizes="260px"
            />
          ) : (
            <TopicPlate
              entityName={post.author.entityName ?? post.author.fullName}
              kind={primaryKind}
            />
          )}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ background: barColor }}
          />
        </div>

        <div
          className="pulse-tilt-layer flex flex-1 flex-col p-4 pb-[18px]"
          style={{ "--layer-z": "20px" } as React.CSSProperties}
        >
          {primaryTopic && (
            <Link
              href={`/topics/${primaryTopic.slug}`}
              className="relative z-10 mb-2.5 w-fit pulse-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              <TopicLabel name={primaryTopic.name} kind={primaryTopic.kind} />
            </Link>
          )}

          <h3 className="pulse-serif text-[22px] leading-[1.16] text-[color:var(--card-foreground)]">
            <Link
              href={`/posts/${post.slug}`}
              className="line-clamp-3 break-words after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              {post.title}
            </Link>
          </h3>

          <div className="mt-auto pt-3.5">
            <LevelBadge level={post.level} className="mb-2" />
            <p className="pulse-label truncate">
              <span className="normal-case tracking-[0.06em]">
                {post.author.entityName ?? post.author.fullName}
              </span>
              <span aria-hidden> — </span>
              <time
                dateTime={post.publishedAt.toISOString()}
                className="normal-case tracking-[0.06em]"
              >
                {relativeTime(post.publishedAt)}
              </time>
            </p>
          </div>
        </div>
      </article>
    </Tilt>
  );
}
