import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { formatRelativeTime } from "@/lib/time";
import type { FeedPost } from "@/types/feed";
import { PostAvatar, ImageFallback } from "./_shared";

export function HeroPostCard({ post }: { post: FeedPost }) {
  const ago = formatRelativeTime(post.createdAt);

  return (
    <article className="relative">
      {/* Decorative ambient blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-[520px] w-[520px] rounded-full bg-[var(--primary)] opacity-[0.08] blur-3xl dark:opacity-[0.12]"
      />

      {/* Image — 4:3 mobile, 16:9 tablet+ */}
      <Link href={`/posts/${post.id}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] sm:aspect-video">
          {post.mediaUrl ? (
            <Image
              src={post.mediaUrl}
              alt={post.title}
              fill
              priority
              className="object-cover transition-transform duration-200 group-hover:scale-[1.015]"
              sizes="(max-width: 1023px) 100vw, 66vw"
            />
          ) : (
            <ImageFallback />
          )}
        </div>
      </Link>

      {/* Meta row — avatar · name · committee · engagement · time */}
      <div className="mt-4 flex items-center gap-2.5">
        <PostAvatar
          fullName={post.author.fullName}
          avatarUrl={post.author.avatarUrl}
          size="md"
        />
        <span className="text-[14px] font-medium text-[var(--foreground)]">
          {post.author.fullName}
        </span>
        {post.author.committeeName && (
          <>
            <span className="text-[var(--muted-foreground)]" aria-hidden>
              ·
            </span>
            <span className="text-[14px] text-[var(--muted-foreground)]">
              {post.author.committeeName}
            </span>
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-3 text-[13px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <Heart size={13} strokeWidth={2} aria-hidden />
            <span>{post.likeCount}</span>
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={13} strokeWidth={2} aria-hidden />
            <span>{post.commentCount}</span>
          </span>
          <span aria-hidden>·</span>
          <time dateTime={post.createdAt.toISOString()}>{ago}</time>
        </div>
      </div>

      {/* Headline — clamp-2 */}
      <Link href={`/posts/${post.id}`}>
        <h2 className="mt-3 line-clamp-2 font-black leading-[1.1] tracking-tight text-[var(--foreground)] transition-colors duration-150 hover:text-[var(--primary)] text-[34px] lg:text-[40px]">
          {post.title}
        </h2>
      </Link>

      {/* Excerpt — clamp-3 */}
      <p className="mt-3 line-clamp-3 text-[18px] leading-[1.6] text-[var(--muted-foreground)]">
        {post.excerpt}
      </p>

      {/* CTA */}
      <Link
        href={`/posts/${post.id}`}
        className="mt-4 inline-flex items-center gap-1 text-[16px] font-bold text-[var(--primary)] hover:underline"
      >
        Read story →
      </Link>
    </article>
  );
}
