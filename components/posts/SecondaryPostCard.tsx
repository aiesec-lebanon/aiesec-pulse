import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { formatRelativeTime } from "@/lib/time";
import type { FeedPost } from "@/types/feed";
import { PostAvatar, ImageFallback } from "./_shared";

export function SecondaryPostCard({ post }: { post: FeedPost }) {
  const ago = formatRelativeTime(post.createdAt);

  return (
    <Link href={`/posts/${post.id}`} className="group block">
      <article
        className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all duration-150
          group-hover:-translate-y-0.5 group-hover:shadow-sm
          dark:group-hover:shadow-none dark:group-hover:border-[var(--muted-foreground)]/30"
      >
        {/* Image — 4:3 */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {post.mediaUrl ? (
            <Image
              src={post.mediaUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
            />
          ) : (
            <ImageFallback />
          )}
        </div>

        {/* Card body */}
        <div className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-2 text-[18px] font-bold leading-[1.3] text-[var(--card-foreground)]">
            {post.title}
          </h3>

          {/* Meta row */}
          <div className="mt-3 flex min-w-0 items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
            <PostAvatar
              fullName={post.author.fullName}
              avatarUrl={post.author.avatarUrl}
              size="sm"
            />
            <span className="min-w-0 truncate">
              {post.author.fullName}
              {post.author.committeeName ? ` · ${post.author.committeeName}` : ""}
            </span>
            <span aria-hidden className="shrink-0">
              ·
            </span>
            <time dateTime={post.createdAt.toISOString()} className="shrink-0">
              {ago}
            </time>

            {/* Engagement — pushed right */}
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <span className="flex items-center gap-1">
                <Heart size={12} strokeWidth={2} aria-hidden />
                {post.likeCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle size={12} strokeWidth={2} aria-hidden />
                {post.commentCount}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
