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
 * 1b's tilt plate: a real `--card` surface with `--elev-2`, pointer
 * perspective, and a 3px bar in the post's topic colour across the image's
 * top — the one sanctioned exception to §0.5's "no card grid" rule.
 *
 * **The card is the link.** It used to be a `<Link>` on the headline with an
 * `::after` overlay meant to cover the whole plate — which it never did: the
 * text panel carries `.pulse-tilt-layer`, and `transform` makes an element
 * the containing block for absolutely-positioned descendants, so the overlay
 * stopped at the panel's edges and the cover image was dead to the click.
 * Wrapping the plate in one anchor removes the bug class entirely, giving the
 * whole 260×360 plate a single hit area.
 *
 * The topic is a label here, not a second link, as in 1b — a nested anchor is
 * invalid, and layering one above a full-plate link would need exactly the
 * z-index-across-stacking-contexts fight that produced the bug above. The
 * topic stays one click away, via the story itself.
 *
 * **Width comes from the caller.** The plate was hard-coded to 260px — right
 * in the feed's horizontal rail, wrong in every `grid-cols-3` that also uses
 * it: a 260px card in a 380px cell, remove button pinned to the cell's far
 * edge, is what the bookmarks page looked like. Its own skeleton is fixed
 * instead (image height, a reserved label row, a two-line title), so a row of
 * these is the same height whatever the copy does.
 */
export function SecondaryPostCard({ post }: { post: FeedPost }) {
  const primaryTopic = post.topics[0];
  // No topic means no topic colour: the bar falls back to the hairline and the
  // plate to its neutral field, rather than claiming a GENERAL filing.
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
          {/* The row is reserved whether or not there is a topic to put in it,
              so a post with no topic does not sit 22px shorter than its
              neighbours in the same rail. */}
          <span className="mb-2.5 flex min-h-[16px] items-center gap-2">
            {primaryTopic ? (
              <TopicLabel name={primaryTopic.name} kind={primaryTopic.kind} />
            ) : (
              <LevelBadge level={post.level} />
            )}
          </span>

          <span className="pulse-serif pulse-clamp-safe line-clamp-2 block min-h-[2.32em] break-words text-[22px] leading-[1.16] text-[color:var(--card-foreground)] transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] group-hover/card:text-[color:var(--primary-text)]">
            {post.title}
          </span>

          {/* Two lines, not one: an office's name and timestamp on the same
              11px mono line ran out of room in a 260px card and truncated the
              publisher — the one fact on the card that says whose story this
              is. Splitting them also matches the reference card's own
              footer. */}
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
              {primaryTopic && <LevelBadge level={post.level} className="shrink-0" />}
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
