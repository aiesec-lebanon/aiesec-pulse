import { Heart, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PostAvatar } from "@/components/posts/_shared";
import { TopicChip } from "@/components/topics/TopicChip";
import { relativeTime } from "@/lib/relative-time";
import type { FeedPost } from "@/types/feed";

export function HeroPost({ post }: { post: FeedPost }) {
  const ago = relativeTime(post.publishedAt);
  const href = `/posts/${post.slug}`;

  return (
    <article className="relative">
      {/* Ambient accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-[520px] w-[520px] rounded-full bg-[var(--primary)] opacity-[0.08] blur-3xl dark:opacity-[0.12]"
      />

      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] sm:aspect-video">
          {post.mediaUrl ? (
            <Image
              src={post.mediaUrl}
              alt={post.mediaAlt ?? ""}
              fill
              priority
              className="object-cover transition-transform duration-200 group-hover:scale-[1.015] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              sizes="(max-width: 1023px) 100vw, 66vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--primary)]/20 via-[var(--primary)]/8 to-[var(--primary)]/4">
              <span
                aria-hidden
                className="select-none font-black text-[96px] leading-none text-[var(--primary-text)] opacity-20"
              >
                A
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="mt-4 flex items-center gap-2.5">
        <PostAvatar fullName={post.author.fullName} avatarUrl={post.author.avatarUrl} size="md" />
        <span className="text-[14px] font-medium text-[var(--foreground)]">
          {post.author.fullName}
        </span>
        {post.author.entityName && (
          <>
            <span className="text-[var(--muted-foreground)]" aria-hidden>
              ·
            </span>
            <span className="text-[14px] text-[var(--muted-foreground)]">
              {post.author.entityName}
            </span>
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-3 text-[13px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <Heart size={13} strokeWidth={2} aria-hidden />
            {post.reactionCount}
            <span className="sr-only"> reactions</span>
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={13} strokeWidth={2} aria-hidden />
            {post.commentCount}
            <span className="sr-only"> comments</span>
          </span>
          <span aria-hidden>·</span>
          <time dateTime={post.publishedAt.toISOString()}>{ago}</time>
        </div>
      </div>

      <h2 className="mt-3 font-black leading-[1.1] tracking-tight text-[34px] lg:text-[40px]">
        <Link
          href={href}
          className="text-[var(--foreground)] transition-colors duration-150 hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
        >
          {post.title}
        </Link>
      </h2>

      {post.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.topics.slice(0, 3).map((topic) => (
            <TopicChip key={topic.slug} slug={topic.slug} name={topic.name} />
          ))}
        </div>
      )}

      <p className="mt-3 line-clamp-3 text-[18px] leading-[1.6] text-[var(--muted-foreground)]">
        {post.excerpt}
      </p>

      <p className="mt-3 text-[13px] text-[var(--muted-foreground)]">
        {post.readingMinutes} min read
      </p>

      <Link
        href={href}
        className="mt-4 inline-flex min-h-[24px] items-center gap-1 text-[16px] font-bold text-[var(--primary-text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        Read story
        <span aria-hidden>→</span>
        <span className="sr-only">: {post.title}</span>
      </Link>
    </article>
  );
}
