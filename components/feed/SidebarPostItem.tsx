import { Heart, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { relativeTime } from "@/lib/relative-time";
import type { FeedPost } from "@/types/feed";

export function SidebarPostItem({ post }: { post: FeedPost }) {
  const ago = relativeTime(post.publishedAt);

  return (
    <Link
      href={`/posts/${post.slug}`}
      className="group block rounded-[var(--radius-lg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      <article
        className="flex gap-4 rounded-[var(--radius-lg)] border border-transparent p-4 transition-all duration-150
          group-hover:-translate-y-0.5 group-hover:bg-[var(--muted)] group-hover:shadow-sm
          motion-reduce:transition-none motion-reduce:group-hover:translate-y-0
          dark:group-hover:shadow-none dark:group-hover:border-[var(--border)]"
      >
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--muted)]">
          {post.mediaUrl ? (
            <Image src={post.mediaUrl} alt="" fill className="object-cover" sizes="96px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/4">
              <span
                aria-hidden
                className="select-none text-[22px] font-black text-[var(--primary-text)] opacity-30"
              >
                A
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[16px] font-bold leading-[1.3] text-[var(--foreground)]">
            {post.title}
          </h3>
          <p className="mt-1.5 truncate text-[13px] text-[var(--muted-foreground)]">
            {post.author.fullName}
            {post.author.entityName ? ` · ${post.author.entityName}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
            <Heart size={11} strokeWidth={2} aria-hidden />
            <span>
              {post.reactionCount}
              <span className="sr-only"> reactions</span>
            </span>
            <MessageCircle size={11} strokeWidth={2} aria-hidden />
            <span>
              {post.commentCount}
              <span className="sr-only"> comments</span>
            </span>
            <time dateTime={post.publishedAt.toISOString()} className="ml-auto">
              {ago}
            </time>
          </div>
        </div>
      </article>
    </Link>
  );
}
