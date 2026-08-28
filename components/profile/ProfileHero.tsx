import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { EntityName } from "@/components/ui/EntityName";
import { SpecStrip } from "@/components/ui/SpecStrip";
import { brandPlaceAccent } from "@/lib/org/display";

const COLUMN = "mx-auto w-full max-w-[1240px] px-6";

/**
 * The hero and the strip fill exactly one screen: the frame is
 * `calc(100svh - var(--rail-h))` less the strip's own height. The strip is
 * rendered here, not by the page, because the two must be measured together
 * — three pages each composing it themselves is three chances to get it
 * wrong.
 *
 * The initials are `aria-hidden`: the name is already in an `h1`, and two
 * stray letters announced first would be noise.
 *
 * Name, position, entity, and member count are all real data — `User` and
 * `Entity` carry no pull-quote or recognition field, so 4a's reference
 * design is illustrative copy there, not a field to wire up.
 */
export function ProfileHero({
  kicker,
  initials,
  name,
  positionTitle,
  entityName,
  standfirst,
  standfirstSlot,
  actions,
  specCells,
  specLabel,
  accent = "var(--primary)",
}: {
  /** What kind of page this is: "Author", "Entity", "You". */
  kicker: string;
  initials: string;
  name: string;
  positionTitle?: string | null;
  /** Already through `entityDisplayName` — the brand lockup, not a place. */
  entityName?: string | null;
  standfirst?: string | null;
  /** Replaces the standfirst paragraph entirely — how `/profile` puts the bio editor where the bio is read. */
  standfirstSlot?: React.ReactNode;
  actions?: React.ReactNode;
  specCells: Array<{ label: string; value: React.ReactNode }>;
  specLabel: string;
  /** The wedge's colour. Defaults to brand blue. */
  accent?: string;
}) {
  // Null for a person's name, the place half for an office's.
  const nameAccent = brandPlaceAccent(name);

  const eyebrow = (
    <p className="pulse-label pulse-label-wide mb-5 flex flex-wrap items-center gap-3">
      <span className="inline-flex h-5 items-center bg-[var(--primary-fill)] px-2 text-[color:var(--primary-foreground)]">
        {kicker}
      </span>
      {positionTitle && <span>{positionTitle}</span>}
      {entityName && <EntityName name={entityName} />}
    </p>
  );

  const body = (
    <>
      {eyebrow}
      <DisplayTitle
        as="h1"
        size="lg"
        title={name}
        accentWord={nameAccent}
        className="max-w-[22ch] text-[color:var(--foreground)]"
      />
      {standfirstSlot ??
        (standfirst ? (
          <p className="mt-6 max-w-[46ch] whitespace-pre-line text-[17px] leading-[1.62] text-[color:var(--muted-foreground)]">
            {standfirst}
          </p>
        ) : null)}
      {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
    </>
  );

  return (
    <>
      <div className="hidden lg:flex lg:h-[calc(100svh-var(--rail-h))] lg:min-h-[480px] lg:flex-col">
        <section className="relative min-h-0 flex-1 overflow-hidden bg-[var(--card)]">
          <div
            aria-hidden
            className="absolute inset-0 z-[1] bg-[var(--background)]"
            style={{ clipPath: "polygon(100% 0, 100% 100%, 58% 100%, 74% 0)" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 z-[2] overflow-hidden"
            style={{
              clipPath: "polygon(100% 0, 100% 100%, 48% 100%, 66% 0)",
              // Mixed toward `--ink` rather than a literal near-black, so the
              // wedge keeps its depth in both themes instead of going flat-bright.
              background: `radial-gradient(135% 115% at 22% 14%, color-mix(in srgb, ${accent} 34%, var(--ink)), color-mix(in srgb, ${accent} 80%, var(--ink)) 68%)`,
            }}
          >
            <Parallax depth={28} className="absolute inset-0">
              <span className="pulse-serif absolute right-[3%] top-[4%] select-none text-[clamp(140px,15vw,250px)] italic leading-[0.78] text-white/[0.16]">
                {initials}
              </span>
            </Parallax>
            <span
              className="absolute -bottom-[22%] -left-[14%] -right-[10%] h-[48%] blur-[30px]"
              style={{
                background:
                  "radial-gradient(55% 60% at 25% 100%, rgb(255 255 255 / 0.16), transparent 70%)",
              }}
            />
          </div>

          <div aria-hidden className="pointer-events-none absolute inset-0 z-[4]">
            <div className="mx-auto grid h-full w-full max-w-[1240px] grid-cols-4 px-6">
              <span className="border-r border-[var(--hairline)]" />
              <span className="border-r border-[var(--hairline)]" />
              <span className="border-r border-[var(--hairline)]" />
              <span />
            </div>
          </div>

          <div className="relative z-[3] flex h-full items-center py-16">
            <div className={COLUMN}>
              <Reveal y={22} className="max-w-[46%]">
                {body}
              </Reveal>
            </div>
          </div>
        </section>

        <SpecStrip
          ariaLabel={specLabel}
          cells={specCells}
          contained
          className="shrink-0 border-b-0"
        />
      </div>

      <section className="relative overflow-hidden border-b border-[var(--hairline)] bg-[var(--card)] px-6 pb-10 pt-12 lg:hidden">
        <span
          aria-hidden
          className="pulse-serif pointer-events-none absolute -right-4 -top-6 select-none text-[150px] italic leading-none"
          style={{ color: `color-mix(in srgb, ${accent} 14%, transparent)` }}
        >
          {initials}
        </span>
        <Reveal y={18} className="relative">
          {body}
        </Reveal>
      </section>
      <div className="lg:hidden">
        <SpecStrip ariaLabel={specLabel} cells={specCells} />
      </div>
    </>
  );
}
