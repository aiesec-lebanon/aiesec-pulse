"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { HeroRotator } from "@/components/feed/HeroRotator";
import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
import { FlipList } from "@/components/motion/FlipList";
import { useMotion } from "@/components/motion/motion-context";
import { Reveal } from "@/components/motion/Reveal";
import type { FeedPost } from "@/types/feed";

const SLIDE_DURATION_MS = 8000;
/** One card plus the gap between two — the distance an arrow press travels. */
const CARD_STRIDE_PX = 280;

/**
 * Up to 5 posts: one full-bleed hero, rest in the rail. `active` lives
 * here (not HeroRotator) so the rail can exclude the hero's own post.
 * "More top stories", not "Also today" — order isn't chronological.
 * `overlapping` reserves the rail's space so a one-post feed has no gap.
 * FlipList animates reflow instead of remounting (was re-revealing all
 * cards). Pause timer keeps remaining dwell time across hovers.
 */
export function FeedLead({ posts }: { posts: FeedPost[] }) {
  const { motion } = useMotion();
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(true);
  const remainingRef = useRef(SLIDE_DURATION_MS);
  const startedAtRef = useRef<number | null>(null);
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

  if (posts.length === 0) return null;

  const secondary = posts.filter((_, i) => i !== active);

  return (
    <>
      <Reveal y={28} scale={0.985} as="section" aria-label="Lead stories">
        <HeroRotator
          slides={posts}
          active={active}
          running={running}
          overlapping={secondary.length > 0}
          onPick={setActive}
          onPause={() => setRunning(false)}
          onResume={() => setRunning(true)}
        />
      </Reveal>

      {secondary.length > 0 && (
        <div className="relative z-20 mx-auto w-full max-w-[1240px] px-6">
          <SecondaryRail posts={secondary} revision={active} />
        </div>
      )}
    </>
  );
}

function SecondaryRail({ posts, revision }: { posts: FeedPost[]; revision: number }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measureEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measureEdges();
    el.addEventListener("scroll", measureEdges, { passive: true });
    const observer = new ResizeObserver(measureEdges);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measureEdges);
      observer.disconnect();
    };
  }, [measureEdges]);

  function nudge(direction: -1 | 1) {
    scrollerRef.current?.scrollBy({
      left: direction * CARD_STRIDE_PX,
      // `smooth` needs no reduced-motion branch — `scroll-behavior: auto`
      // on the root already turns it off globally.
      behavior: "smooth",
    });
  }

  const scrollable = !(edges.start && edges.end);

  return (
    <section aria-label="More top stories" className="mt-12 sm:-mt-[96px] lg:-mt-[124px]">
      <div className="mb-5 flex items-end justify-between gap-4">
        <p className="pulse-label pulse-label-wide sm:text-white/70">More top stories</p>

        {scrollable && (
          <div className="hidden items-center gap-2 sm:flex">
            <RailArrow direction={-1} disabled={edges.start} onPress={nudge} />
            <RailArrow direction={1} disabled={edges.end} onPress={nudge} />
          </div>
        )}
      </div>

      {/* tabIndex + label make this scrollable strip keyboard-reachable —
          otherwise it's a WCAG 2.1.1 failure axe flags. */}
      <div
        ref={scrollerRef}
        tabIndex={0}
        role="group"
        aria-label="More top stories, scrollable"
        className="overflow-x-auto pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        <FlipList revision={revision} className="flex snap-x snap-mandatory items-stretch gap-5">
          {posts.map((post) => (
            <div
              key={post.id}
              data-flip-key={post.id}
              className="pulse-flip w-[260px] shrink-0 snap-start"
            >
              <SecondaryPostCard post={post} />
            </div>
          ))}
        </FlipList>
      </div>

      <div className="mt-6 flex justify-end">
        <Link
          href="/search"
          className="group inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--card)] px-5 text-[15px] font-bold text-[color:var(--foreground)] shadow-[var(--elev-1)] transition-[color,border-color,box-shadow,transform] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] hover:-translate-y-[calc(2px*var(--motion-travel))] hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] hover:text-[color:var(--primary-text)] hover:shadow-[var(--elev-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:border-white/25 sm:bg-transparent sm:text-white/85 sm:hover:border-white sm:hover:text-white"
        >
          Browse every story
          <ArrowRight
            size={15}
            strokeWidth={2.5}
            aria-hidden
            className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:translate-x-[calc(3px*var(--motion-travel))]"
          />
        </Link>
      </div>
    </section>
  );
}

function RailArrow({
  direction,
  disabled,
  onPress,
}: {
  direction: -1 | 1;
  disabled: boolean;
  onPress: (direction: -1 | 1) => void;
}) {
  const Icon = direction === -1 ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={() => onPress(direction)}
      disabled={disabled}
      aria-label={direction === -1 ? "Scroll to earlier stories" : "Scroll to more stories"}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[var(--hairline)] text-[color:var(--muted-foreground)] transition-[background-color,border-color,color,transform] duration-[calc(var(--dur-micro)*var(--motion-scale))] hover:border-[var(--primary)] hover:text-[color:var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] active:scale-95 disabled:opacity-35 sm:border-white/25 sm:text-white/75 sm:hover:border-white sm:hover:bg-white/10 sm:hover:text-white"
    >
      <Icon size={14} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
