import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { relativeTime } from "@/lib/relative-time";

type HeroPostProps = {
  post: {
    id: string;
    title: string;
    content: string;
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

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function HeroPost({ post }: HeroPostProps) {
  const ago = relativeTime(post.createdAt);
  const mono = initials(post.author.fullName);

  return (
    <article className="relative">
      {/* Decorative blob — sits at top-right of the hero region */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-[520px] w-[520px] rounded-full bg-[var(--primary)] opacity-[0.08] blur-3xl dark:opacity-[0.12]"
      />

      {/* Image — 4:3 on mobile, 16:9 on tablet+ */}
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
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--primary)]/20 via-[var(--primary)]/8 to-[var(--primary)]/4">
              <span className="select-none font-black text-[96px] leading-none text-[var(--primary)] opacity-20">
                A
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Meta row — avatar + name + entity + engagement + time */}
      <div className="mt-4 flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-[var(--primary)] text-[12px] font-bold text-[var(--primary-foreground)]"
        >
          {mono}
        </span>
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

        {/* Right-aligned: engagement + time */}
        <div className="ml-auto flex shrink-0 items-center gap-3 text-[13px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <Heart size={13} strokeWidth={2} aria-hidden />
            <span>{post._count.likes}</span>
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={13} strokeWidth={2} aria-hidden />
            <span>{post._count.comments}</span>
          </span>
          <span aria-hidden>·</span>
          <time dateTime={post.createdAt.toISOString()}>{ago}</time>
        </div>
      </div>

      {/* Headline */}
      <Link href={`/posts/${post.id}`}>
        <h2 className="mt-3 font-black leading-[1.1] tracking-tight text-[var(--foreground)] hover:text-[var(--primary)] transition-colors duration-150 text-[34px] lg:text-[40px]">
          {post.title}
        </h2>
      </Link>

      {/* Excerpt */}
      <p className="mt-3 line-clamp-3 text-[18px] leading-[1.6] text-[var(--muted-foreground)]">
        {post.content}
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
