import Image from "next/image";
import Link from "next/link";

import type { TopicKind } from "@/app/generated/prisma/enums";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { CoverLightbox } from "@/components/post-detail/CoverLightbox";
import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { SpecStrip } from "@/components/ui/SpecStrip";
import { TopicPill } from "@/components/ui/TopicPill";
import { tokensForKind } from "@/lib/topics-shared";

export type StoryHeroProps = {
  title: string;
  /** The phrase the author chose to set italic in the topic's colour. */
  titleAccent: string | null;
  cover: string | null;
  coverAlt: string;
  primaryTopic: { slug: string; name: string; kind: TopicKind } | null;
  specCells: Array<{ label: string; value: React.ReactNode }>;
};

/**
 * Decorative four-column rules, drawn inside the content column so they
 * align with the spec strip's grid below — full-frame rules gave two grids
 * a few pixels apart. `pointer-events-none` on both wrapper and grid, or
 * clicks aimed at the photo hit this instead and the lightbox never opens.
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
 * Cover hero (angled clip) or typographic hero (no cover), both gated to
 * `lg:`. Frame is `calc(100svh - var(--rail-h))` minus the spec strip, so
 * the first screen reads as a cover, not a half-visible crop. Type stays in
 * the shell's `max-w-[1240px]` column even though imagery bleeds full-width,
 * keeping headline and header wordmark aligned. `.pulse-story-scrim` derives
 * from `--background`, not a fixed dark frame, so type stays `--foreground`
 * correctly in both themes.
 */
export function StoryHero({
  title,
  titleAccent,
  cover,
  coverAlt,
  primaryTopic,
  specCells,
}: StoryHeroProps) {
  const accentColor = primaryTopic ? tokensForKind(primaryTopic.kind).text : undefined;

  const eyebrow = (
    <p className="pulse-label mb-6 flex flex-wrap items-center gap-3">
      {primaryTopic && (
        <Link
          href={`/topics/${primaryTopic.slug}`}
          className="pointer-events-auto rounded-[var(--radius-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          <TopicPill name={primaryTopic.name} kind={primaryTopic.kind} />
        </Link>
      )}
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
      {/* lg: only — no cover, the typographic hero. */}
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
