import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { formatRelativeTime } from "@/lib/time";
import type { FeedPost } from "@/types/feed";
import { PostAvatar, ImageFallback } from "./_shared";

export function SidebarPostCard({ post }: { post: FeedPost }) {
  const ago = formatRelativeTime(post.createdAt);

  return (
    <Link href={`/posts/${post.id}`} className="group block">
      <article
        className="flex gap-4 rounded-[var(--radius-lg)] border border-transparent p-4 transition-all duration-150
          group-hover:-translate-y-0.5 group-hover:bg-[var(--muted)] group-hover:shadow-sm
          dark:group-hover:shadow-none dark:group-hover:border-[var(--border)]"
      >
        {/* Square thumbnail */}
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl">
          {post.mediaUrl ? (
            <Image
              src={post.mediaUrl}
              alt=""
              fill
              className="object-cover"
              sizes="96px"
            />
          ) : (
            <ImageFallback />
          )}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[16px] font-bold leading-[1.3] text-[var(--foreground)]">
            {post.title}
          </h3>
          <div className="mt-1.5 flex items-center gap-1.5">
            <PostAvatar
              fullName={post.author.fullName}
              avatarUrl={post.author.avatarUrl}
              size="sm"
            />
            <p className="truncate text-[13px] text-[var(--muted-foreground)]">
              {post.author.fullName}
              {post.author.committeeName ? ` · ${post.author.committeeName}` : ""}
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
            <Heart size={11} strokeWidth={2} aria-hidden />
            <span>{post.likeCount}</span>
            <MessageCircle size={11} strokeWidth={2} aria-hidden />
            <span>{post.commentCount}</span>
            <time dateTime={post.createdAt.toISOString()} className="ml-auto">
              {ago}
            </time>
          </div>
        </div>
      </article>
    </Link>
  );
}
