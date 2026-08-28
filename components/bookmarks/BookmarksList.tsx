"use client";

import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";

import { toggleBookmark } from "@/app/actions/bookmarks";
import { FlipList } from "@/components/motion/FlipList";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityName } from "@/components/ui/EntityName";
import { TopicPlate } from "@/components/ui/TopicPlate";
import type { BookmarkedPost } from "@/lib/feed";
import { relativeTime } from "@/lib/relative-time";
import { tokensForKind } from "@/lib/topics-shared";

/**
 * Saved stories: a hairline-divided index, not a card grid — the grid it
 * replaced was wrong in three ways, all visible at once: `SecondaryPostCard`
 * was hard-coded to 260px, so every card floated inside a 380px grid cell;
 * the remove button was positioned against the *cell*, not the card, so it
 * sat in mid-air a hundred pixels from what it removed; and a three-up grid
 * of tilting plates is the feed's lead treatment, which §0.5 reserves for
 * exactly that.
 */

/** Long enough for `.pulse-row-out` to finish before the row is unmounted. */
const EXIT_MS = 420;

export function BookmarksList({ initialPosts }: { initialPosts: BookmarkedPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function remove(postId: string) {
    const removed = posts.find((p) => p.id === postId);
    if (!removed || leaving) return;

    // `.pulse-row-out` animates `max-height` to zero, so it needs the row's
    // real height to start from — a fixed default would clip a two-line
    // headline the instant the animation began, which reads as a jump rather
    // than a collapse.
    const row = document.querySelector<HTMLElement>(`[data-flip-key="${postId}"]`);
    if (row) row.style.setProperty("--row-h", `${row.offsetHeight}px`);

    setLeaving(postId);
    const restore = () =>
      setPosts((prev) => (prev.some((p) => p.id === postId) ? prev : [...prev, removed]));

    // Runs in parallel with the exit animation, so the server round-trip is
    // never added on top of it.
    setTimeout(() => {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setLeaving(null);
    }, EXIT_MS);

    startTransition(async () => {
      try {
        const result = await toggleBookmark(postId);
        // The action toggled it back ON (a race with another tab, or a
        // stale click after removal) — put it back rather than silently
        // disagree with the server's record.
        if (result.ok && result.bookmarked) restore();
      } catch {
        restore();
      }
    });
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        eyebrow="Nothing saved"
        heading="Nothing bookmarked yet."
        accentWord="bookmarked"
        body="Save a story from the feed or a topic archive and it will show up here."
        action={{ href: "/feed", label: "Browse the feed" }}
      />
    );
  }

  return (
    <FlipList
      as="ul"
      revision={posts.length}
      aria-label="Your bookmarked posts"
      className="mt-2 flex flex-col"
    >
      {posts.map((post) => (
        <BookmarkRow
          key={post.id}
          post={post}
          leaving={leaving === post.id}
          onRemove={() => remove(post.id)}
        />
      ))}
    </FlipList>
  );
}

function BookmarkRow({
  post,
  leaving,
  onRemove,
}: {
  post: BookmarkedPost;
  leaving: boolean;
  onRemove: () => void;
}) {
  const topic = post.topics[0];
  const publisher = post.author.entityName ?? post.author.fullName;

  return (
    <li
      data-flip-key={post.id}
      className={[
        "pulse-flip group relative border-b border-[var(--hairline)]",
        leaving ? "pulse-row-out" : "",
      ].join(" ")}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-[-1px] h-px origin-left scale-x-0 bg-[var(--primary)] transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:scale-x-100 group-focus-within:scale-x-100"
      />

      <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 py-5 sm:grid-cols-[64px_minmax(0,1fr)_auto_auto] sm:gap-5">
        <Link
          href={`/posts/${post.slug}`}
          tabIndex={-1}
          aria-hidden
          className="relative block h-16 w-16 shrink-0 overflow-hidden bg-[var(--ink)]"
        >
          {post.mediaUrl ? (
            <Image
              src={post.mediaUrl}
              alt=""
              fill
              sizes="64px"
              className="object-cover transition-transform duration-[calc(var(--dur-scene)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:scale-[calc(1+0.08*var(--motion-travel))]"
            />
          ) : (
            <TopicPlate entityName={publisher} kind={topic?.kind ?? null} />
          )}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ background: topic ? tokensForKind(topic.kind).accent : "var(--hairline)" }}
          />
        </Link>

        <div className="min-w-0">
          <Link
            href={`/posts/${post.slug}`}
            className="pulse-serif pulse-clamp-safe line-clamp-2 block break-words text-[21px] leading-[1.2] text-[color:var(--foreground)] transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] hover:text-[color:var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            {post.title}
          </Link>
          <p className="pulse-label mt-2 truncate">
            {topic && (
              <>
                <span style={{ color: tokensForKind(topic.kind).text }}>{topic.name}</span>
                <span aria-hidden className="px-2 opacity-60">
                  ·
                </span>
              </>
            )}
            <EntityName name={publisher} className="normal-case tracking-[0.06em]" />
          </p>
        </div>

        <p className="pulse-label col-start-2 row-start-2 whitespace-nowrap sm:col-start-3 sm:row-start-1">
          Saved <time dateTime={post.savedAt.toISOString()}>{relativeTime(post.savedAt)}</time>
        </p>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove "${post.title}" from bookmarks`}
          className="col-start-3 row-start-1 flex h-9 w-9 items-center justify-center justify-self-end rounded-full text-[color:var(--muted-foreground)] transition-[color,background-color,transform] duration-[calc(var(--dur-micro)*var(--motion-scale))] hover:bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] hover:text-[color:var(--destructive-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] active:scale-90 sm:col-start-4"
        >
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </li>
  );
}
