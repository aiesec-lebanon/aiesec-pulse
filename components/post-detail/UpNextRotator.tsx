"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useMotion } from "@/components/motion/motion-context";
import { MetaLine } from "@/components/ui/MetaLine";
import { TopicPill } from "@/components/ui/TopicPill";
import { TopicPlate } from "@/components/ui/TopicPlate";
import type { FeedPost } from "@/types/feed";

const SLIDE_DURATION_MS = 8000;

/**
 * Auto-advancing "next story" rail with a dot index and dwell-time bar.
 * Timer/pause-on-hover/keyboard behaviour mirrors FeedLead/HeroRotator
 * exactly: remaining-time-preserving pause, roving-tabindex tablist,
 * Reduced motion stops the loop outright.
 */
export function UpNextRotator({ posts }: { posts: FeedPost[] }) {
  const { motion } = useMotion();
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(true);
  const remainingRef = useRef(SLIDE_DURATION_MS);
  const startedAtRef = useRef<number | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rotatable = posts.length > 1;

  const advance = useCallback(() => {
    setActive((i) => (i + 1) % posts.length);
  }, [posts.length]);

  useEffect(() => {
    remainingRef.current = SLIDE_DURATION_MS;
  }, [active]);

  useEffect(() => {
    if (!rotatable || motion === "reduced" || !running) return;

    startedAtRef.current = Date.now();
    const timer = setTimeout(advance, remainingRef.current);

    return () => {
      clearTimeout(timer);
      if (startedAtRef.current !== null) {
        remainingRef.current = Math.max(
          0,
          remainingRef.current - (Date.now() - startedAtRef.current)
        );
        startedAtRef.current = null;
      }
    };
  }, [active, running, rotatable, motion, advance]);

  useEffect(() => {
    tabRefs.current.length = posts.length;
  }, [posts.length]);

  if (posts.length === 0) return null;
  const post = posts[active];

  function pick(index: number) {
    setActive(index);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % posts.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + posts.length) % posts.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = posts.length - 1;
    if (next === null) return;

    event.preventDefault();
    pick(next);
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- pause-on-hover/focus for the auto-advance timer (WCAG 2.2.2), matching HeroRotator/FeedLead exactly.
    <section
      aria-label="More related news"
      onMouseEnter={() => setRunning(false)}
      onMouseLeave={() => setRunning(true)}
      onFocus={() => setRunning(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setRunning(true);
      }}
      className="mt-16 border-t border-[var(--hairline)] bg-[var(--card)] py-12"
    >
      <div className="mx-auto w-full max-w-[1240px] px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <p className="pulse-label">More related news</p>

          {rotatable && (
            <div className="flex items-center gap-3">
              <div role="tablist" aria-label="Next story" className="flex items-center gap-1.5">
                {posts.map((p, i) => {
                  const isActive = i === active;
                  return (
                    <button
                      key={p.id}
                      ref={(el) => {
                        tabRefs.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls="up-next-panel"
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => pick(i)}
                      onKeyDown={(event) => handleKeyDown(event, i)}
                      className="flex min-h-[26px] min-w-[26px] items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                    >
                      <span
                        aria-hidden
                        className={[
                          "block h-[6px] w-[6px] rounded-full transition-all duration-[calc(var(--dur-element)*var(--motion-scale))]",
                          isActive ? "bg-[var(--primary)]" : "bg-[var(--border)]",
                        ].join(" ")}
                      />
                      <span className="sr-only">{p.title}</span>
                    </button>
                  );
                })}
              </div>
              <span
                aria-hidden
                className="relative h-[2px] w-16 overflow-hidden bg-[var(--border)]"
              >
                {motion === "full" && (
                  <span
                    key={active}
                    className="pulse-ambient pulse-rotator-bar-h absolute inset-0 bg-[var(--primary)]"
                    style={{ "--rotator-duration": "8000ms" } as React.CSSProperties}
                  />
                )}
              </span>
            </div>
          )}
        </div>

        <Link
          id="up-next-panel"
          key={post.id}
          href={`/posts/${post.slug}`}
          className="group grid grid-cols-1 items-center gap-6 rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)] sm:grid-cols-[minmax(0,340px)_minmax(0,1fr)] sm:gap-9"
        >
          <span className="relative block h-[200px] w-full overflow-hidden bg-[var(--stage-deep)]">
            {post.mediaUrl ? (
              <Image
                src={post.mediaUrl}
                alt=""
                fill
                sizes="(min-width: 640px) 340px, 100vw"
                className="object-cover transition-transform duration-[calc(var(--dur-scene)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
              />
            ) : (
              <TopicPlate
                entityName={post.author.entityName ?? post.author.fullName}
                kind={post.topics[0]?.kind ?? null}
              />
            )}
          </span>
          <span className="min-w-0">
            <MetaLine
              className="mb-4"
              items={[
                post.topics[0] && (
                  <TopicPill key="topic" name={post.topics[0].name} kind={post.topics[0].kind} />
                ),
                post.author.entityName,
                `${post.readingMinutes} min`,
                post.publishedAt && (
                  <time key="published" dateTime={post.publishedAt.toISOString()}>
                    {post.publishedAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                ),
              ]}
            />
            <h2 className="pulse-serif pulse-serif-sm pulse-balance break-words text-[color:var(--foreground)]">
              {post.title}
            </h2>
            <p className="mt-3 line-clamp-2 max-w-[52ch] text-[16px] leading-[1.6] text-[color:var(--muted-foreground)]">
              {post.excerpt}
            </p>
          </span>
        </Link>
      </div>
    </section>
  );
}
