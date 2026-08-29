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
import { splitOnWord } from "@/components/ui/DisplayTitle";
import { EntityName } from "@/components/ui/EntityName";
import { MetaLine } from "@/components/ui/MetaLine";
import { TopicPill } from "@/components/ui/TopicPill";
import { relativeTime } from "@/lib/relative-time";
import { tokensForKind } from "@/lib/topics-shared";
import type { FeedPost } from "@/types/feed";

const TITLE_ID = "hero-rotator-title";

/**
 * Controlled: `active`/`running`/timer live in FeedLead so the rail can
 * share the same index. Every slide stays mounted so a change
 * cross-dissolves instead of popping. Aspect-ratio height with a capped
 * max-h avoids forcing scroll; `lg:` padding reserves room for the rail.
 */
export function HeroRotator({
  slides,
  active,
  running,
  overlapping,
  onPick,
  onPause,
  onResume,
}: {
  slides: FeedPost[];
  active: number;
  running: boolean;
  /** Whether the secondary rail overlaps the hero's bottom edge — reserves
   *  room for it so a one-post feed (no rail) isn't left with a blank void
   *  under its headline. */
  overlapping: boolean;
  onPick: (_index: number) => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const { motion } = useMotion();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rotatable = slides.length > 1;

  // Focus follows the tick only for clicks/arrow keys inside this component,
  // not every `active` change — otherwise the auto-advance timer would
  // steal focus from wherever the reader actually is.
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
  // splitOnWord, not DisplayTitle — this headline sets its own size/clamp,
  // and DisplayTitle's text-[clamp(...)] utility would silently lose to
  // .pulse-serif-xl's unlayered class.
  const headline = splitOnWord(slide.title, slide.titleAccent);
  const accentColor = primaryTopic ? tokensForKind(primaryTopic.kind).text : undefined;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- pause-on-hover/focus for the auto-advance timer (WCAG 2.2.2); the section itself grants no new interactivity, its focusable children already carry their own handlers.
    <section
      aria-label="Lead stories"
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onResume();
      }}
      className="group relative aspect-[4/5] max-h-[min(620px,82vh)] w-full overflow-hidden bg-[var(--stage-deep)] text-white shadow-[var(--elev-3)] sm:aspect-[16/10] lg:aspect-[21/9] lg:max-h-[min(700px,88vh)] lg:min-h-[540px]"
    >
      <Parallax depth={70} scale={1.1} className="absolute inset-0">
        {slides.map((s, i) => (
          <span
            key={s.id}
            aria-hidden={i !== active}
            className="pulse-hero-slide"
            data-active={i === active}
          >
            {s.mediaUrl ? (
              <Image
                src={s.mediaUrl}
                alt={i === active ? (s.mediaAlt ?? "") : ""}
                fill
                // Only the first slide blocks paint — the rest lazy-load with 8s to spare.
                priority={i === 0}
                className="object-cover"
                sizes="100vw"
              />
            ) : (
              <span
                aria-hidden
                className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_92%,var(--primary))]"
              >
                {/* Canvas runs only for the visible slide — 5 live particle
                    fields would be 4 wasted rAF loops. The plate below is
                    identical across coverless slides, so there's still
                    something to dissolve between. */}
                {i === active && (
                  <span className="absolute inset-0 opacity-90">
                    <NetworkField density={200} intensity={1} />
                  </span>
                )}
              </span>
            )}
          </span>
        ))}
      </Parallax>

      <span aria-hidden className="pulse-hero-scrim z-[2]" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[-10%] bottom-[-30%] z-[2] h-[60%] rounded-full bg-[var(--glow-primary)] blur-3xl"
      />
      {/* Wipe plays once per lead change — keyed on `active` so it remounts instead of looping. */}
      {rotatable && <span key={`wipe-${active}`} aria-hidden className="pulse-wipe z-[3]" />}

      {/* Link is a direct child of the section, not an ::after on the
          headline — the panel is absolutely positioned and would bound the
          overlay to the bottom strip, leaving the photo (what readers
          actually click) dead. */}
      <Link
        href={href}
        aria-labelledby={TITLE_ID}
        className="absolute inset-0 z-[4] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--primary)]"
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
                    "block rounded-full transition-all duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]",
                    isActive
                      ? "h-[9px] w-[9px] bg-[var(--primary)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_24%,transparent)]"
                      : "h-[5px] w-[5px] bg-white/40 hover:h-[7px] hover:w-[7px] hover:bg-white/70",
                  ].join(" ")}
                />
                <span
                  className={[
                    "pulse-label text-[9px] transition-colors duration-[calc(var(--dur-element)*var(--motion-scale))]",
                    isActive ? "text-white" : "text-white/55",
                  ].join(" ")}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="sr-only">{s.title}</span>
              </button>
            );
          })}

          <span aria-hidden className="w-px flex-1 bg-gradient-to-b from-white/25 to-white/5" />

          {/* Always mounted — only animation-play-state toggles on hover/focus.
              Conditionally rendering on `running` used to restart the fill
              from 0% on every pause instead of freezing it. */}
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

      {/* pointer-events-none keeps the frame link clickable; interactive
          children opt back in individually. Copy uses the shell's content
          column so the headline lines up with the header wordmark elsewhere. */}
      <div
        id="hero-rotator-panel"
        role="tabpanel"
        className={[
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 py-6 sm:py-8 lg:py-12",
          overlapping ? "sm:pb-[112px] lg:pb-[156px]" : "",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-[1240px] px-6">
          <div key={slide.id} className="max-w-[92%] sm:max-w-[74%] lg:max-w-[58%]">
            <p
              className="pulse-copy-in pulse-label mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-white/70"
              style={{ ["--reveal-delay" as string]: "0ms" }}
            >
              {primaryTopic && <TopicPill name={primaryTopic.name} kind={primaryTopic.kind} />}
              {slide.author.entityName && (
                <EntityName name={slide.author.entityName} className="text-white/90" />
              )}
              <span aria-hidden>—</span>
              <span>{slide.readingMinutes} min</span>
            </p>

            <h2
              id={TITLE_ID}
              className="pulse-copy-in pulse-serif pulse-balance pulse-clamp-safe line-clamp-3 max-w-[18ch] break-words text-[clamp(30px,4.2vw,62px)] leading-[0.96]"
              style={{ ["--reveal-delay" as string]: "90ms", ["--copy-y" as string]: "30px" }}
            >
              {headline.before}
              {headline.accent && (
                <em
                  className="pulse-serif-accent"
                  style={accentColor ? { ["--accent-color" as string]: accentColor } : undefined}
                >
                  {headline.accent}
                </em>
              )}
              {headline.after}
            </h2>

            <div
              className="pulse-copy-in mt-5 hidden sm:block"
              style={{ ["--reveal-delay" as string]: "190ms" }}
            >
              <p className="line-clamp-2 max-w-[58ch] text-[17px] leading-[1.65] text-white/75">
                {slide.excerpt}
              </p>
            </div>
          </div>

          <div
            key={`meta-${slide.id}`}
            className="pulse-copy-in relative z-10 mt-6 flex flex-wrap items-center gap-x-4 gap-y-3"
            style={{ ["--reveal-delay" as string]: "260ms" }}
          >
            {slide.author.entityName && (
              <span className="pointer-events-auto">
                <FollowButton
                  targetType={FollowTarget.ENTITY}
                  targetId={slide.publisherEntityId}
                  initialState={slide.entityFollowState}
                  label={slide.author.entityName}
                  compact
                />
              </span>
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
      </div>
    </section>
  );
}
