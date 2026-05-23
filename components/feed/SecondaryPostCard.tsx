import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { relativeTime } from "@/lib/relative-time";

type SecondaryPostCardProps = {
  post: {
    id: string;
    title: string;
    mediaUrl: string | null;
    createdAt: Date;
    author: {
      fullName: string;
      committeeName: string | null;
    };
    _count: {
      likes: number;
      comments: number;
    };
  };
};

export function SecondaryPostCard({ post }: SecondaryPostCardProps) {
  const ago = relativeTime(post.createdAt);

  return (
    <Link href={`/posts/${post.id}`} className="group block">
      <article
        className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all duration-150
          group-hover:-translate-y-0.5 group-hover:shadow-sm
          dark:group-hover:shadow-none dark:group-hover:border-[var(--muted-foreground)]/30"
      >
        {/* Image — 4:3 */}
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
              <span className="select-none text-[48px] font-black text-[var(--primary)] opacity-20">
                A
              </span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-2 text-[18px] font-bold leading-[1.3] text-[var(--card-foreground)]">
            {post.title}
          </h3>

          {/* Meta row */}
          <div className="mt-3 flex items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
            <span className="min-w-0 truncate">
              {post.author.fullName}
              {post.author.committeeName
                ? ` · ${post.author.committeeName}`
                : ""}
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
                {post._count.likes}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle size={12} strokeWidth={2} aria-hidden />
                {post._count.comments}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
