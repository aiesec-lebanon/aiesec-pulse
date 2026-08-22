"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { HeroRotator } from "@/components/feed/HeroRotator";
import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
import { useMotion } from "@/components/motion/motion-context";
import { Reveal } from "@/components/motion/Reveal";
import type { FeedPost } from "@/types/feed";

const SLIDE_DURATION_MS = 8000;

/**
 * The feed's lead complex: one shared pool of up to five posts, one of them
 * in the full-bleed hero at a time, the other four in the "also today" rail
 * beneath it. The two halves share `active` — lifted here rather than owned
 * by `HeroRotator` — because the rail has to know which post the hero is
 * currently showing, to leave it out of its own list. Advancing the hero
 * (by timer or by hand) therefore also re-shuffles the rail, with each
 * card's own `Reveal` giving the swap a real transition rather than a hard
 * cut.
 *
 * The pause timer preserves its remaining time rather than resetting to a
 * full dwell on every hover: `remainingRef` is only ever reduced by elapsed
 * time in the running effect's cleanup, and only reset to the full duration
 * when `active` itself changes (a fresh slide always gets a fresh dwell,
 * however it was reached).
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
          onPick={setActive}
          onPause={() => setRunning(false)}
          onResume={() => setRunning(true)}
        />
      </Reveal>

      {secondary.length > 0 && (
        <div className="mx-auto w-full max-w-[1240px] px-6">
          <section aria-label="Also today" className="mt-16">
            <div className="mb-5 flex items-end justify-between gap-4">
              <p className="pulse-label pulse-label-wide">Also today</p>
            </div>
            {/* Focusable: a scrollable region that cannot be reached by keyboard is
                a 2.1.1 failure, and axe flags it. `tabIndex` plus a name makes the
                strip navigable and announced on entry. Keyed on `active` so the
                whole row remounts (and re-reveals) each time the hero advances,
                rather than the four cards silently swapping in place. */}
            <div
              key={active}
              tabIndex={0}
              role="group"
              aria-label="More stories today, scrollable"
              className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              {secondary.map((post, i) => (
                <Reveal key={post.id} y={20} x={16} delay={i * 70} className="shrink-0">
                  <SecondaryPostCard post={post} />
                </Reveal>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
