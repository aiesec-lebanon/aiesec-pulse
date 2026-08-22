"use client";

import { Heart, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { FollowTarget } from "@/app/generated/prisma/enums";
import { FollowButton } from "@/components/engagement/FollowButton";
import { useMotion } from "@/components/motion/motion-context";
import { NetworkField } from "@/components/motion/NetworkField";
import { Parallax } from "@/components/motion/Parallax";
import { MetaLine } from "@/components/ui/MetaLine";
import { TopicPill } from "@/components/ui/TopicPill";
import { relativeTime } from "@/lib/relative-time";
import type { FeedPost } from "@/types/feed";

/**
 * The full-bleed rotating lead — 1b in the reference file. Purely a
 * controlled view: `FeedLead` (`components/feed/FeedLead.tsx`) owns
 * `active`/`running` and the timer, because the sibling "also today" rail
 * needs the same `active` index to know which post to leave out of its own
 * list — two components reading one piece of state, not two copies of it.
 *
 * No `border-radius` anywhere on the frame, deliberately: a full-bleed
 * section that spans the page edge to edge reads as a rendering fault with
 * rounded corners, so this hand-rolls its background instead of reaching for
 * `.pulse-media-frame` (`--radius-lg` baked in). Height is aspect-ratio-driven
 * up to a capped `max-h`, so a very tall (or very wide, e.g. an ultrawide
 * monitor) viewport never turns the hero into something a reader has to
 * scroll past just to see the rest of the page.
 */
export function HeroRotator({
  slides,
  active,
  running,
  onPick,
  onPause,
  onResume,
}: {
  slides: FeedPost[];
  active: number;
  running: boolean;
  onPick: (index: number) => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const { motion } = useMotion();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rotatable = slides.length > 1;

  // Focus follows the active tick, but only when the change came from inside
  // this component (a click or an arrow key) — not every time `active`
  // changes, which also happens on the timer's own auto-advance and would
  // otherwise steal focus from wherever the reader actually is.
  function pick(index: number) {
    onPick(index);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % slides.length;
    else if (event.key === "ArrowUp") next = (index - 1 + slides.length) % slides.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = slides.length - 1;
    if (next === null) return;

    event.preventDefault();
    pick(next);
  }

  useEffect(() => {
    tabRefs.current.length = slides.length;
  }, [slides.length]);

  if (slides.length === 0) return null;
  const slide = slides[active];
  const href = `/posts/${slide.slug}`;
  const primaryTopic = slide.topics[0];

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- pause-on-hover/focus for the auto-advance timer (WCAG 2.2.2); the section itself grants no new interactivity, its focusable children (the index rail's tabs) already carry their own handlers.
    <section
      aria-label="Lead stories"
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onResume();
      }}
      className="group relative aspect-[4/5] max-h-[min(620px,82vh)] w-full overflow-hidden bg-[var(--stage-deep)] text-white shadow-[var(--elev-3)] sm:aspect-[16/10] lg:aspect-[21/9]"
    >
      <Parallax depth={70} scale={1.1} className="absolute inset-0">
        {slide.mediaUrl ? (
          <Image
            key={slide.id}
            src={slide.mediaUrl}
            alt={slide.mediaAlt ?? ""}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div
            aria-hidden
            className="relative h-full w-full bg-[color-mix(in_srgb,var(--ink)_92%,var(--primary))]"
          >
            <div className="absolute inset-0 opacity-90">
              <NetworkField density={200} intensity={1} />
            </div>
          </div>
        )}
      </Parallax>

      <span aria-hidden className="pulse-hero-scrim" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[-10%] bottom-[-30%] h-[60%] rounded-full bg-[var(--glow-primary)] blur-3xl"
      />

      {rotatable && (
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="Lead stories"
          className="absolute inset-y-6 left-2 z-20 hidden flex-col items-center gap-3 sm:left-4 sm:flex lg:left-8"
        >
          <span
            aria-hidden
            className="pulse-label mb-1 [writing-mode:vertical-rl] tracking-[0.3em] text-white/45"
          >
            Index
          </span>

          {slides.map((s, i) => {
            const isActive = i === active;
            return (
              <button
                key={s.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="hero-rotator-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => pick(i)}
                onKeyDown={(event) => handleKeyDown(event, i)}
                className="flex min-h-[44px] min-w-[26px] flex-col items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                <span
                  aria-hidden
                  className={[
                    "block rounded-full transition-all duration-[calc(var(--dur-element)*var(--motion-scale))]",
                    isActive
                      ? "h-[9px] w-[9px] bg-[var(--primary)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_24%,transparent)]"
                      : "h-[5px] w-[5px] bg-white/40",
                  ].join(" ")}
                />
                <span className="pulse-label text-[9px] text-white/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="sr-only">{s.title}</span>
              </button>
            );
          })}

          <span aria-hidden className="w-px flex-1 bg-gradient-to-b from-white/25 to-white/5" />

          {/* Always mounted (once motion is full and there's more than one
              slide) — only `animation-play-state` toggles on hover/focus.
              The earlier version conditionally rendered this on `running`,
              which unmounted-and-remounted it on every pause, restarting the
              fill from 0% instead of freezing it in place. */}
          <span aria-hidden className="relative h-16 w-[2px] overflow-hidden bg-white/15">
            {motion === "full" && (
              <span
                key={active}
                className="pulse-ambient pulse-rotator-bar absolute inset-0 bg-[var(--primary)]"
                style={
                  {
                    "--rotator-duration": "8000ms",
                    animationPlayState: running ? "running" : "paused",
                  } as React.CSSProperties
                }
              />
            )}
          </span>
        </div>
      )}

      <div
        id="hero-rotator-panel"
        role="tabpanel"
        className="absolute inset-x-0 bottom-0 z-10 p-6 sm:p-8 sm:pl-16 lg:p-12 lg:pl-28"
      >
        <div className="max-w-[92%] sm:max-w-[74%] lg:max-w-[58%]">
          <p className="pulse-label mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-white/70">
            {primaryTopic && <TopicPill name={primaryTopic.name} kind={primaryTopic.kind} />}
            {slide.author.entityName && (
              <span className="text-white/90">{slide.author.entityName}</span>
            )}
            <span aria-hidden>—</span>
            <span>{slide.readingMinutes} min</span>
          </p>

          <h2 className="pulse-serif pulse-serif-xl pulse-balance">
            <Link
              key={slide.id}
              href={href}
              className="line-clamp-3 break-words after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
            >
              {slide.title}
            </Link>
          </h2>

          <p className="mt-5 hidden max-w-[58ch] line-clamp-2 text-[17px] leading-[1.65] text-white/74 sm:block">
            {slide.excerpt}
          </p>
        </div>

        <div className="relative z-10 mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          {slide.author.entityName && (
            <FollowButton
              targetType={FollowTarget.ENTITY}
              targetId={slide.publisherEntityId}
              initialState={slide.entityFollowState}
              label={slide.author.entityName}
              compact
            />
          )}

          <MetaLine
            className="text-white/70"
            items={[
              <span key="author">{slide.author.fullName}</span>,
              <time key="age" dateTime={slide.publishedAt.toISOString()}>
                {relativeTime(slide.publishedAt)}
              </time>,
            ]}
          />

          <div className="tabular ml-auto flex shrink-0 items-center gap-4 text-[13px] text-white/70">
            <span className="flex items-center gap-1.5">
              <Heart size={14} strokeWidth={2} aria-hidden />
              {slide.reactionCount}
              <span className="sr-only"> reactions</span>
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle size={14} strokeWidth={2} aria-hidden />
              {slide.commentCount}
              <span className="sr-only"> comments</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
