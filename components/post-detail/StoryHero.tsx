import Image from "next/image";

import type { TopicKind } from "@/app/generated/prisma/enums";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { CoverLightbox } from "@/components/post-detail/CoverLightbox";
import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { EntityName } from "@/components/ui/EntityName";
import { SpecStrip } from "@/components/ui/SpecStrip";
import { TopicPill } from "@/components/ui/TopicPill";
import { tokensForKind } from "@/lib/topics-shared";

export type StoryHeroProps = {
  title: string;
  /** The phrase the author chose to set italic in the topic's colour. */
  titleAccent: string | null;
  cover: string | null;
  coverAlt: string;
  primaryTopic: { name: string; kind: TopicKind } | null;
  entityName: string;
  specCells: Array<{ label: string; value: React.ReactNode }>;
};

/**
 * Decorative four-column rules across a hero — drawn inside the *content
 * column* so its rules land on the same four columns the spec strip below
 * divides into. Full-frame rules plus contained cells gave a hero two grids
 * at once, three pixels apart — worse than either alone.
 *
 * `pointer-events-none` on the wrapper as well as the grid: the wrapper spans
 * the whole frame at a higher z-index than the cover, and without it every
 * click aimed at the photograph landed on an invisible div — which is what
 * stopped the cover lightbox from opening.
 */
const GRID_OVERLAY = (
  <div className="mx-auto grid h-full w-full max-w-[1240px] grid-cols-4 px-6">
    <span className="border-r border-[var(--hairline)]" />
    <span className="border-r border-[var(--hairline)]" />
    <span className="border-r border-[var(--hairline)]" />
    <span />
  </div>
);

/** The shell's content column. */
const COLUMN = "mx-auto w-full max-w-[1240px] px-6";

/**
 * The post's own header — UI ref 2a (a cover image behind an angled clip) and
 * 2b (no cover, a purely typographic hero), each gated to `lg:` where the
 * composition was designed.
 *
 * Three structural rules, all of them things that were wrong before:
 *
 * 1. **Hero and spec strip fill exactly one screen.** The frame is
 *    `calc(100svh - var(--rail-h))` minus the strip, so a reader arriving on a
 *    story sees the whole hero with the strip's rules sitting on the bottom
 *    edge — not a strip half-peeking above the fold with the rest below.
 *    That's what makes the first screen read as a cover, not a crop.
 * 2. **Imagery bleeds; type does not.** The frame spans the viewport, but every
 *    line of type inside it sits in the shell's own `max-w-[1240px]` column.
 *    Heroes used to carry their own 64px page margin, so on a 1920px screen
 *    the headline started 300px left of the header wordmark, and nothing on
 *    the page lined up.
 * 3. **The hero belongs to the page, not to a dark frame.** `.pulse-story-scrim`
 *    derives its ramp from `--background`, so the photograph fades into whichever
 *    page it's on and the type can stay `--foreground`. A fixed near-black scrim
 *    under a hard-coded `text-white` headline worked in dark mode but put
 *    white type on a near-white photograph in light mode.
 */
export function StoryHero({
  title,
  titleAccent,
  cover,
  coverAlt,
  primaryTopic,
  entityName,
  specCells,
}: StoryHeroProps) {
  const accentColor = primaryTopic ? tokensForKind(primaryTopic.kind).text : undefined;

  const eyebrow = (
    <p className="pulse-label mb-6 flex flex-wrap items-center gap-3">
      {primaryTopic && <TopicPill name={primaryTopic.name} kind={primaryTopic.kind} />}
      <EntityName name={entityName} className="text-[color:var(--foreground)]" />
    </p>
  );

  const headline = (size: "lg" | "md", extra?: string) => (
    <DisplayTitle
      as="h1"
      size={size}
      title={title}
      accentWord={titleAccent}
      accentColor={accentColor}
      className={["text-[color:var(--foreground)]", extra].filter(Boolean).join(" ")}
    />
  );

  if (cover) {
    return (
      <>
        <div className="hidden lg:flex lg:h-[calc(100svh-var(--rail-h))] lg:min-h-[560px] lg:flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--background)]">
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
              <span aria-hidden className="pulse-story-scrim" />
              {/* Inside the clip, so the control's hit area is exactly the
                  visible photograph. */}
              <CoverLightbox src={cover} alt={coverAlt} />
            </div>

            <div aria-hidden className="pointer-events-none absolute inset-0 z-[4]">
              {GRID_OVERLAY}
            </div>

            {/* Type, in the shell's column. `pointer-events-none` so the block
                does not swallow clicks meant for the cover behind it. */}
            <div className="pointer-events-none absolute inset-x-0 top-16 z-[4]">
              <div className={COLUMN}>
                {eyebrow}
                {headline("lg", "max-w-[16ch]")}
              </div>
            </div>
          </div>

          <SpecStrip
            ariaLabel="Story details"
            cells={specCells}
            contained
            className="shrink-0 border-b-0 bg-[color-mix(in_srgb,var(--card)_86%,transparent)] backdrop-blur-md"
          />
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
            <span aria-hidden className="pulse-story-scrim-v" />
            <CoverLightbox src={cover} alt={coverAlt} />
          </div>

          <div className="mx-auto -mt-20 w-full max-w-[760px] px-6 sm:-mt-24">
            <Reveal y={24} className="pulse-plate p-7 shadow-[var(--elev-4)] sm:p-10">
              {eyebrow}
              {headline("lg")}
            </Reveal>
          </div>
        </header>
        <div className="lg:hidden">
          <SpecStrip ariaLabel="Story details" cells={specCells} className="mt-6" />
        </div>
      </>
    );
  }

  const glowColor = primaryTopic ? tokensForKind(primaryTopic.kind).accent : "var(--primary)";

  return (
    <>
      {/* 2b, lg: only — no cover, the typographic hero. */}
      <div className="hidden lg:flex lg:h-[calc(100svh-var(--rail-h))] lg:min-h-[520px] lg:flex-col">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {GRID_OVERLAY}
          </div>

          <Parallax depth={-40} className="pointer-events-none absolute inset-0">
            <div
              aria-hidden
              className="absolute inset-x-[-10%] -top-[30%] h-[110%] blur-[60px]"
              style={{
                background: `radial-gradient(55% 60% at 78% 22%, color-mix(in srgb, ${glowColor} 26%, transparent), transparent 70%), radial-gradient(45% 55% at 12% 8%, color-mix(in srgb, ${glowColor} 12%, transparent), transparent 72%)`,
              }}
            />
          </Parallax>

          <div className="relative flex h-full items-center pb-10 pt-[70px]">
            <div className={COLUMN}>
              {eyebrow}
              {headline("lg", "max-w-[20ch]")}
            </div>
          </div>
        </div>

        <SpecStrip
          ariaLabel="Story details"
          cells={specCells}
          contained
          className="shrink-0 border-b-0"
        />
      </div>

      <header className="mx-auto w-full max-w-[760px] px-6 pt-16 lg:hidden">
        <Reveal y={24}>
          {eyebrow}
          {headline("lg")}
        </Reveal>
      </header>
      <div className="lg:hidden">
        <SpecStrip ariaLabel="Story details" cells={specCells} className="mt-6" />
      </div>
    </>
  );
}
