import Image from "next/image";

import type { TopicKind } from "@/app/generated/prisma/enums";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { SpecStrip } from "@/components/ui/SpecStrip";
import { TopicPill } from "@/components/ui/TopicPill";
import { tokensForKind } from "@/lib/topics-shared";

export type StoryHeroProps = {
  title: string;
  cover: string | null;
  coverAlt: string;
  primaryTopic: { name: string; kind: TopicKind } | null;
  entityName: string;
  specCells: Array<{ label: string; value: React.ReactNode }>;
};

const GRID_OVERLAY = (
  <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-4">
    <span className="border-r border-[var(--hairline)]" />
    <span className="border-r border-[var(--hairline)]" />
    <span className="border-r border-[var(--hairline)]" />
    <span />
  </div>
);

/**
 * The post's own header — UI ref 2a (a cover image, split behind an angled
 * clip-path) combined with 2b (no cover, a purely typographic hero) — each
 * gated to `lg:`, where the composition was designed; the reference file has
 * no mobile variant of either. Below `lg:`, both branches fall back to the
 * plain treatment this page has always shipped, plus a `SpecStrip` neither
 * previously had: the strip is already responsive on its own
 * (`grid-cols-2 sm:grid-cols-4`), so there's no reason to withhold the
 * Entity/Published/Reading/Reactions facts from a narrow viewport just
 * because the clip-path/parallax theatre above them is desktop-only.
 */
export function StoryHero({
  title,
  cover,
  coverAlt,
  primaryTopic,
  entityName,
  specCells,
}: StoryHeroProps) {
  if (cover) {
    return (
      <>
        <div className="relative hidden h-[620px] overflow-hidden bg-[var(--stage-deep)] text-white lg:block">
          <div className="pulse-story-clip absolute inset-0 z-[2] overflow-hidden">
            <Parallax depth={-70} scale={1.18} className="absolute inset-0">
              <Image
                src={cover}
                alt={coverAlt}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </Parallax>
            <span aria-hidden className="pulse-image-scrim" />
            <span aria-hidden className="pulse-hero-scrim" />
          </div>

          <div className="absolute inset-0 z-[4]">{GRID_OVERLAY}</div>

          <div className="absolute left-16 right-10 top-16 z-[4]">
            <p className="pulse-label mb-6 flex flex-wrap items-center gap-3 text-white/70">
              {primaryTopic && <TopicPill name={primaryTopic.name} kind={primaryTopic.kind} />}
              <span className="text-white/90">{entityName}</span>
            </p>
            <DisplayTitle as="h1" size="lg" title={title} className="text-white" />
          </div>

          <div className="absolute inset-x-0 bottom-0 z-[5]">
            <SpecStrip
              ariaLabel="Story details"
              cells={specCells}
              className="border-none bg-[color-mix(in_srgb,#06080d_88%,transparent)] [&_dt]:text-white/60 [&_dd]:text-white"
            />
          </div>
        </div>

        <header className="relative lg:hidden">
          <div className="pulse-media-frame relative aspect-[4/3] w-full overflow-hidden rounded-none sm:aspect-[16/9]">
            <Parallax depth={-70} scale={1.18} className="absolute inset-0">
              <Image
                src={cover}
                alt={coverAlt}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </Parallax>
            <span aria-hidden className="pulse-image-scrim" />
          </div>

          <div className="mx-auto -mt-24 w-full max-w-[760px] px-6 sm:-mt-28">
            <Reveal y={24} className="pulse-plate p-7 shadow-[var(--elev-4)] sm:p-10">
              <DisplayTitle
                as="h1"
                size="lg"
                title={title}
                className="text-[color:var(--foreground)]"
              />
            </Reveal>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[760px] px-6 lg:hidden">
          <SpecStrip ariaLabel="Story details" cells={specCells} className="mt-6" />
        </div>
      </>
    );
  }

  const glowColor = primaryTopic ? tokensForKind(primaryTopic.kind).accent : "var(--primary)";

  return (
    <>
      {/* 2b, lg: only — no cover, the typographic hero. */}
      <div className="relative hidden overflow-hidden px-16 pb-0 pt-[70px] lg:block">
        {GRID_OVERLAY}
        <Parallax
          depth={-40}
          className="pointer-events-none absolute -right-[6%] -top-[10%] h-[70%] w-[52%]"
        >
          <div
            aria-hidden
            className="h-full w-full blur-[40px]"
            style={{
              background: `radial-gradient(circle at 60% 40%, color-mix(in srgb, ${glowColor} 22%, transparent), transparent 66%)`,
            }}
          />
        </Parallax>
        <div className="relative">
          <p className="pulse-label mb-6 flex flex-wrap items-center gap-3">
            {primaryTopic && <TopicPill name={primaryTopic.name} kind={primaryTopic.kind} />}
            <span className="text-[color:var(--muted-foreground)]">{entityName}</span>
          </p>
          <DisplayTitle
            as="h1"
            size="lg"
            title={title}
            className="max-w-[22ch] text-[color:var(--foreground)]"
          />
        </div>
        <SpecStrip ariaLabel="Story details" cells={specCells} className="relative mt-11" />
      </div>

      {/* Legacy no-cover header, unchanged, below lg:. */}
      <header className="mx-auto w-full max-w-[760px] px-6 pt-16 lg:hidden">
        <Reveal y={24}>
          <DisplayTitle
            as="h1"
            size="lg"
            title={title}
            className="text-[color:var(--foreground)]"
          />
        </Reveal>
      </header>
      <div className="mx-auto w-full max-w-[760px] px-6 lg:hidden">
        <SpecStrip ariaLabel="Story details" cells={specCells} className="mt-6" />
      </div>
    </>
  );
}
