import { Heart, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { TopicChip } from "@/components/topics/TopicChip";
import { relativeTime } from "@/lib/relative-time";
import type { FeedPost } from "@/types/feed";

export function SecondaryPostCard({ post }: { post: FeedPost }) {
  const ago = relativeTime(post.publishedAt);

  return (
    // A topic chip below is its own <Link> to the topic archive — nesting it
    // inside the card's own post link would produce invalid nested anchors,
    // so the chips row is a sibling of the Link, not a descendant of it.
    <div className="flex h-full flex-col gap-2">
      <Link
        href={`/posts/${post.slug}`}
        className="group block flex-1 rounded-[var(--radius-lg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        <article
          className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] transition-all duration-150
          group-hover:-translate-y-0.5 group-hover:shadow-sm
          motion-reduce:transition-none motion-reduce:group-hover:translate-y-0
          dark:group-hover:shadow-none dark:group-hover:border-[var(--muted-foreground)]/30"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-[var(--muted)]">
            {post.mediaUrl ? (
              <Image
                src={post.mediaUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--primary)]/20 via-[var(--primary)]/8 to-[var(--primary)]/4">
                <span
                  aria-hidden
                  className="select-none text-[48px] font-black text-[var(--primary-text)] opacity-20"
                >
                  A
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col p-4">
            <h3 className="line-clamp-2 text-[18px] font-bold leading-[1.3] text-[var(--card-foreground)]">
              {post.title}
            </h3>

            <div className="mt-3 flex items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
              <span className="min-w-0 truncate">
                {post.author.fullName}
                {post.author.entityName ? ` · ${post.author.entityName}` : ""}
              </span>
              <span aria-hidden className="shrink-0">
                ·
              </span>
              <time dateTime={post.publishedAt.toISOString()} className="shrink-0">
                {ago}
              </time>

              <div className="ml-auto flex shrink-0 items-center gap-3">
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
              </div>
            </div>
          </div>
        </article>
      </Link>

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
