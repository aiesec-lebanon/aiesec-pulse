import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { formatRelativeTime } from "@/lib/time";
import type { FeedPost } from "@/types/feed";
import { PostAvatar } from "./_shared";

export function CompactPostCard({ post }: { post: FeedPost }) {
  const ago = formatRelativeTime(post.createdAt);

  return (
    <Link href={`/posts/${post.id}`} className="group block">
      <article
        className="border-t border-[var(--border)] py-4 transition-colors duration-150
          group-hover:border-[var(--primary)]"
      >
        <h3 className="line-clamp-2 text-[16px] font-bold leading-[1.3] text-[var(--foreground)] transition-colors duration-150 group-hover:text-[var(--primary)]">
          {post.title}
        </h3>
        <div className="mt-2 flex items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
          <PostAvatar
            fullName={post.author.fullName}
            avatarUrl={post.author.avatarUrl}
            size="sm"
          />
          <span className="min-w-0 truncate">
            {post.author.fullName}
            {post.author.committeeName ? ` · ${post.author.committeeName}` : ""}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1">
              <Heart size={11} strokeWidth={2} aria-hidden />
              {post.likeCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={11} strokeWidth={2} aria-hidden />
              {post.commentCount}
            </span>
            <time dateTime={post.createdAt.toISOString()}>{ago}</time>
          </div>
        </div>
      </article>
    </Link>
  );
}
