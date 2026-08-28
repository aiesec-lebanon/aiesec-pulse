import Image from "next/image";
import Link from "next/link";

import { EntityName } from "@/components/ui/EntityName";
import { relativeTime } from "@/lib/relative-time";
import type { FeedPost } from "@/types/feed";

export function SidebarPostItem({ post, index }: { post: FeedPost; index?: number }) {
  return (
    <Link
      href={`/posts/${post.slug}`}
      className="group relative flex items-center gap-5 border-t border-[var(--hairline)] py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-[var(--primary)] transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:scale-x-100 group-focus-visible:scale-x-100"
      />

      {index !== undefined && (
        <span className="pulse-label hidden shrink-0 sm:block">
          {String(index).padStart(2, "0")}
        </span>
      )}

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
        <p className="pulse-label mt-2 truncate">
          <EntityName
            name={post.author.entityName ?? post.author.fullName}
            className="normal-case tracking-[0.06em]"
          />
        </p>
      </div>

      <time dateTime={post.publishedAt.toISOString()} className="pulse-label shrink-0 text-right">
        {relativeTime(post.publishedAt)}
      </time>
    </Link>
  );
}
