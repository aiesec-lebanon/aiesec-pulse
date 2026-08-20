import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { relativeTime } from "@/lib/relative-time";
import type { FeedPost } from "@/types/feed";

/**
 * The quiet register. After the lead frame and the card row, the page needs
 * somewhere to breathe out — these are index rows, not more cards: a hairline
 * rule, a small square of the cover, the headline, and nothing else competing.
 *
 * The hover moment is the rule itself, which wipes to brand blue from the left
 * as the pointer arrives.
 */
export function SidebarPostItem({ post }: { post: FeedPost }) {
  return (
    <Link
      href={`/posts/${post.slug}`}
      className="group relative flex items-center gap-5 border-t border-[var(--hairline)] py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-[var(--primary)] transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:scale-x-100 group-focus-visible:scale-x-100"
      />

      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--stage-deep)]">
        {post.mediaUrl ? (
          <Image
            src={post.mediaUrl}
            alt=""
            fill
            className="object-cover transition-transform duration-[calc(var(--dur-scene)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:scale-[calc(1+0.08*var(--motion-travel))]"
            sizes="64px"
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(140deg,var(--glow-primary),transparent_65%)]"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[16px] font-bold leading-[1.35] text-[color:var(--foreground)] transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] group-hover:text-[color:var(--primary-text)]">
          {post.title}
        </h3>
        <p className="pulse-label mt-2 truncate text-[10px]">
          <span className="normal-case tracking-[0.06em]">
            {post.author.entityName ?? post.author.fullName}
          </span>
          <span aria-hidden> · </span>
          <time dateTime={post.publishedAt.toISOString()} className="normal-case tracking-[0.06em]">
            {relativeTime(post.publishedAt)}
          </time>
        </p>
      </div>

      <ArrowUpRight
        size={18}
        strokeWidth={2}
        aria-hidden
        className="shrink-0 text-[color:var(--muted-foreground)] opacity-0 transition-[opacity,transform] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:translate-x-[calc(2px*var(--motion-travel))] group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </Link>
  );
}
