import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityName } from "@/components/ui/EntityName";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { MetaLine } from "@/components/ui/MetaLine";
import { SpecStrip } from "@/components/ui/SpecStrip";
import { StatusPill } from "@/components/ui/StatusPill";
import { TextTabs } from "@/components/ui/TextTabs";
import { TopicLabel, TopicPill } from "@/components/ui/TopicPill";
import { TopicPlate } from "@/components/ui/TopicPlate";
import { requireAdmin } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

/** Rendered from the same components every other screen uses — check both
 * themes when one of them changes. */
export default async function AdminSystemPage() {
  await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-10 sm:px-6">
      <p className="pulse-label pulse-label-wide">Design system</p>
      <DisplayTitle
        as="h1"
        size="md"
        title="Three faces, three colours, one grid"
        accentWord="three"
        className="mt-2 text-[color:var(--foreground)]"
      />
      <p className="mt-3 max-w-[62ch] text-[17px] leading-[1.6] text-[color:var(--muted-foreground)]">
        Every part below is the component the product uses, not a picture of it. Check both themes.
      </p>

      <Section n="01" title="Type registers">
        <div className="flex flex-col gap-6">
          <Specimen label="Display · Instrument Serif · headlines, numerals, plate initials">
            <DisplayTitle
              as="p"
              size="lg"
              title="Four hundred volunteers rebuilt a river town"
              accentWord="rebuilt"
            />
          </Specimen>

          <Specimen label="Body · Lato · standfirsts, prose, buttons, nav">
            <p className="max-w-[62ch] text-[17px] leading-[1.6] text-[color:var(--foreground)]">
              Nine weeks, three municipal governments, and the first deployment AIESEC in Brazil has
              coordinated end to end since 2019.
            </p>
          </Specimen>

          <Specimen label="Instrument · IBM Plex Mono · eyebrows, counters, metadata">
            <MetaLine items={["AIESEC in Brazil", "6 min", "4h ago", "214 reactions"]} />
          </Specimen>
        </div>
      </Section>

      <Section n="02" title="Topic colour">
        <p className="mb-5 max-w-[62ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          One colour per topic kind, not per topic. Blue is a programme, teal is a function, orange
          is what the network decides together. Filled pills carry the colour; a card that already
          has a cover takes the quiet label instead.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <TopicPill name="Outgoing Global Volunteer" kind="PROGRAMME" />
          <TopicPill name="Marketing" kind="FUNCTION" />
          <TopicPill name="Governance" kind="GENERAL" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <TopicLabel name="Outgoing Global Volunteer" kind="PROGRAMME" />
          <TopicLabel name="Marketing" kind="FUNCTION" />
          <TopicLabel name="Governance" kind="GENERAL" />
        </div>

        <p className="pulse-label pulse-label-wide mb-4 mt-10 opacity-70">
          Neutrals — dark and light, same roles
        </p>
        <div className="grid grid-cols-1 gap-px bg-[var(--hairline)] sm:grid-cols-2">
          <NeutralRamp
            mode="Dark"
            bg="#0b0e13"
            card="#151a21"
            fg="#f5f5f5"
            mut="#9ca7ae"
            line="#2a3038"
          />
          <NeutralRamp
            mode="Light"
            bg="#eceef1"
            card="#ffffff"
            fg="#11141a"
            mut="#5d6675"
            line="#dfe3e7"
          />
        </div>
        <p className="mt-4 max-w-[70ch] text-[13px] leading-[1.6] text-[color:var(--muted-foreground)]">
          Every screen reads these off <code className="font-mono">--background</code> /{" "}
          <code className="font-mono">--card</code> /{" "}
          <code className="font-mono">--foreground</code> /{" "}
          <code className="font-mono">--muted-foreground</code> /{" "}
          <code className="font-mono">--hairline</code> — the same five roles the reference file
          calls <code className="font-mono">--bg</code>/<code className="font-mono">--card</code>/
          <code className="font-mono">--fg</code>/<code className="font-mono">--mut</code>/
          <code className="font-mono">--line</code>. Only{" "}
          <code className="font-mono">--primary-text</code> differs by mode on purpose — lighter on
          dark, darker on light — so blue text clears contrast on both.
        </p>
      </Section>

      <Section n="03" title="Space &amp; grid">
        <div className="grid grid-cols-1 gap-9 sm:grid-cols-3">
          <SpaceSpec
            value="60px"
            label="Page margin, left and right, on every screen — the one measurement that never changes. Responsive down to 20px (--page-x)."
          />
          <SpaceSpec
            value="54px"
            label="Sticky header height (--rail-h). Anything pinned below it offsets from this number."
          />
          <SpaceSpec
            value="4 col"
            label="Hairline grid overlay over the elsewhere-in-network section — decorative, z-indexed above the ground, below the type."
          />
        </div>
      </Section>

      <Section n="04" title="Motion catalogue">
        <p className="mb-6 max-w-[70ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          Named, reused devices — plus the specific bug each one cost, so the next screen
          doesn&apos;t re-earn it.
        </p>
        <div className="flex flex-col">
          <MotionSpec
            name="Reveal"
            tag="components/motion/Reveal.tsx"
            body="Content is visible by default and reveals once, then disconnects. Gotcha: an opacity:0 wrapper composites text away from contrast tooling even though a sighted reader never sees it hidden — travel and a short blur carry the arrival instead, leaving real colour against real background at every instant."
          />
          <MotionSpec
            name="Parallax / Tilt"
            tag="components/motion/Parallax.tsx"
            body="One shared rAF loop for every parallax layer, gated on IntersectionObserver so an off-screen hero costs nothing. Tilt is gated to pointerType === 'mouse' and resets on focusin, so a touch drag or a keyboard tab never leaves a plate stuck at an angle."
          />
          <MotionSpec
            name="Rotator"
            tag="components/feed/HeroRotator.tsx"
            body="A setTimeout per active slide, not the reference file's animationend trick — same visible effect, easier to test. Gated on the Motion preference (an auto-rotating hero is an ambient loop) and paused on hover/focus-within so a reader can always stop it (WCAG 2.2.2); picking a tick restarts the timer fresh rather than resuming mid-count."
          />
          <MotionSpec
            name="Ticker"
            tag=".pulse-ticker-track"
            body="A doubled track scrolling at a constant rate, edge-masked so entries don't clip mid-word. The content is duplicated once in markup, not via a pseudo-element, so it works for any number of real items. Gotcha: the track translates -50%, so it needs exactly two copies — and two copies of a two-item list is still a two-item list, which is how the marquee ended up starting halfway across the page. Repeat the set to at least eight entries first. Carries .pulse-ambient, so Reduced motion stops it outright."
          />
          <MotionSpec
            name="Route transition"
            tag="components/motion/RouteTransition.tsx"
            body="A wrapper keyed on the pathname, so every navigation has one authored arrival instead of a hard swap. The header, the lit stage and the scroll container stay outside it. Gotcha: a transform or a filter on an ancestor makes it the containing block for position:fixed descendants — anything inside a page that must stay viewport-fixed during a transition has to be sticky, or portalled to document.body. That is why the story page's engagement bar is sticky and the cover lightbox is a portal."
          />
          <MotionSpec
            name="Cross-dissolve"
            tag=".pulse-hero-slide"
            body="Every rotator slide stays mounted and stacked; only data-active moves. Gotcha: rendering just the active slide makes a dissolve impossible — there is nothing to dissolve from, so a change of lead is a cut. The outgoing frame stays painted while the incoming one settles out of a 1.07 scale and a 12px bloom, with one projector wipe across the frame keyed on the active index."
          />
          <MotionSpec
            name="FLIP list"
            tag="components/motion/FlipList.tsx"
            body="Measure before, measure after, write the inverse as --flip-x/--flip-y, clear it next frame and let CSS carry each item home. Identity comes from data-flip-key, never the index — the whole point is that item three became item two. A child absent from the previous measurement is new and gets the enter animation instead of a slide from position zero."
          />
          <MotionSpec
            name="Press"
            tag=".pulse-pop / .pulse-burst / .pulse-roll"
            body="Overshoot-and-settle on the mark, a dissolving ring in the control's own colour, and a counter that rolls up out of the old figure's place. Each is a one-shot animation on an element keyed by a press counter: remounting is what restarts a CSS animation, and a boolean flag would need a timer to clear it. None of them replaces a signal — colour, fill and the live region still carry the meaning alone."
            last
          />
        </div>
      </Section>

      <Section n="05" title="Spec strip">
        <SpecStrip
          ariaLabel="Example story details"
          cells={[
            { label: "Entity", value: "AIESEC in Brazil" },
            { label: "Published", value: "21 Aug 2026" },
            { label: "Reading", value: "6 min" },
            { label: "Reactions", value: "214" },
          ]}
        />
      </Section>

      <Section n="06" title="Text tabs">
        <p className="mb-5 max-w-[62ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          A row of filters is a navigation, and navigations do not need boxes. Keep the boxed
          treatment for a standalone action, where the box is what makes it look pressable.
        </p>
        <TextTabs
          ariaLabel="Example filters"
          items={[
            { href: "/admin/system", label: "All", isActive: true, count: 12 },
            { href: "/admin/system#programmes", label: "Programmes", isActive: false },
            { href: "/admin/system#functions", label: "Functions", isActive: false },
          ]}
        />
      </Section>

      <Section n="07" title="Topic plate">
        <p className="mb-5 max-w-[62ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          What a post shows when it has no cover, which is most posts: the publishing entity&apos;s
          initials on a field of its topic&apos;s colour. The fourth is the neutral plate, for a
          post carrying no topic at all — defaulting those to GENERAL painted them full orange and
          told the reader they were filed under something they are not.
        </p>
        <div className="grid grid-cols-1 gap-px bg-[var(--hairline)] sm:grid-cols-4">
          <div className="aspect-[16/10]">
            <TopicPlate entityName="AIESEC in Brazil" kind="PROGRAMME" />
          </div>
          <div className="aspect-[16/10]">
            <TopicPlate entityName="AIESEC in Kuala Lumpur" kind="FUNCTION" />
          </div>
          <div className="aspect-[16/10]">
            <TopicPlate entityName="AIESEC International" kind="GENERAL" />
          </div>
          <div className="aspect-[16/10]">
            <TopicPlate entityName="AIESEC in Lebanon" kind={null} />
          </div>
        </div>
      </Section>

      <Section n="08" title="The brand lockup">
        <p className="mb-5 max-w-[62ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          GIS stores an office&apos;s place &mdash; &ldquo;Lebanon&rdquo;, &ldquo;Cairo&rdquo;. The
          brand&apos;s name for that office is the full lockup, and shipping the bare place name is
          a brand violation rather than a shorter label: &ldquo;Lebanon published this&rdquo; says a
          country published it. The two-tone treatment accents the <em>place</em>, and is a title
          treatment used <strong>once per screen</strong> &mdash; an accent in every card footer and
          byline is a decoration that pulls the eye off the headline. Resolved once at the data
          boundary by{" "}
          <code className="rounded-[var(--radius-sm)] bg-[var(--muted)] px-1.5 py-0.5 text-[13px]">
            entityDisplayName(name, kind)
          </code>
          , painted by{" "}
          <code className="rounded-[var(--radius-sm)] bg-[var(--muted)] px-1.5 py-0.5 text-[13px]">
            EntityName
          </code>
          . Never concatenate it by hand.
        </p>
        <div className="flex flex-col gap-4">
          <Specimen label="plain — the default, and what almost every surface uses">
            <p className="text-[17px] text-[color:var(--foreground)]">
              <EntityName name="AIESEC in Lebanon" />
            </p>
          </Specimen>
          <Specimen label="plain, in the instrument register — a card footer, a byline">
            <p className="pulse-label">
              <EntityName name="AIESEC in Lebanon" />
            </p>
          </Specimen>
          <Specimen label="title — the place half accented. Once per screen, on an h1.">
            <p className="pulse-serif pulse-serif-md text-[color:var(--foreground)]">
              <EntityName name="AIESEC in Lebanon" tone="title" />
            </p>
          </Specimen>
          <Specimen label="a region and the global office keep their own names">
            <p className="text-[17px] text-[color:var(--foreground)]">
              <EntityName name="Middle East and Africa" /> &middot;{" "}
              <EntityName name="AIESEC International" />
            </p>
          </Specimen>
        </div>
      </Section>

      <Section n="09" title="Topic chip vs status badge">
        <p className="mb-5 max-w-[62ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          A topic is a filing mark and takes a <strong>square</strong> corner; a status or a reach
          badge is a pill. The corner is what tells them apart at a glance, which is the whole
          reason the two shapes exist &mdash; they carry different kinds of fact about the same
          post.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <TopicPill name="Global Volunteer" kind="PROGRAMME" />
          <TopicPill name="Information Management" kind="FUNCTION" />
          <TopicPill name="Leadership" kind="GENERAL" />
          <LevelBadge level="NETWORK" />
          <StatusPill status="IN_REVIEW" />
        </div>
      </Section>

      <Section n="10" title="Empty and error states">
        <p className="mb-5 max-w-[62ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          Type-led, never illustration-led. A drawing says &ldquo;nothing here&rdquo; the same way
          whether the feed is empty or the network is down; a sentence says which.
        </p>
        <EmptyState
          eyebrow="404"
          heading="This story isn't here any more"
          accentWord="any"
          body="It may have been unpublished, or the link is out of date. An entity can pull a post back to draft at any time."
          action={{ href: "/feed", label: "Back to the feed" }}
          secondaryAction={{ href: "/search", label: "Search instead" }}
        />
      </Section>
    </main>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t border-[var(--hairline)] pt-8">
      <h2 className="pulse-label pulse-label-wide mb-6">
        {n} · {title}
      </h2>
      {children}
    </section>
  );
}

function Specimen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="pulse-label mb-3 opacity-70">{label}</p>
      {children}
    </div>
  );
}

/**
 * One theme's five ground tokens, rendered against their own literal hex
 * values (not `var(--...)`) on purpose — this specimen's whole job is
 * letting a reader compare both themes at once without flipping the page's
 * own theme back and forth.
 */
function NeutralRamp({
  mode,
  bg,
  card,
  fg,
  mut,
  line,
}: {
  mode: string;
  bg: string;
  card: string;
  fg: string;
  mut: string;
  line: string;
}) {
  const tokens = [
    { label: "background", value: bg },
    { label: "card", value: card },
    { label: "foreground", value: fg },
    { label: "muted-fg", value: mut },
    { label: "hairline", value: line },
  ];
  return (
    <div className="p-5" style={{ background: bg }}>
      <p className="pulse-label pulse-label-wide mb-4" style={{ color: mut }}>
        {mode}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {tokens.map((t) => (
          <div key={t.label}>
            <span
              className="block h-9 w-full"
              style={{ background: t.value, border: `1px solid ${line}` }}
            />
            <span
              className="mt-2 block truncate font-mono text-[9px] uppercase tracking-[0.1em]"
              style={{ color: mut }}
            >
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpaceSpec({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="pulse-serif pulse-serif-sm text-[color:var(--primary-text)]">{value}</p>
      <p className="mt-2.5 text-[14px] leading-[1.5] text-[color:var(--muted-foreground)]">
        {label}
      </p>
    </div>
  );
}

function MotionSpec({
  name,
  tag,
  body,
  last = false,
}: {
  name: string;
  tag: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div
      className={[
        "grid grid-cols-1 gap-3 border-t border-[var(--hairline)] py-5 sm:grid-cols-[180px_1fr] sm:gap-7",
        last ? "border-b" : "",
      ].join(" ")}
    >
      <p>
        <span className="block text-[15px] font-bold leading-[1.3] text-[color:var(--foreground)]">
          {name}
        </span>
        <span className="pulse-label mt-1 block opacity-70">{tag}</span>
      </p>
      <p className="text-[14px] leading-[1.6] text-[color:var(--muted-foreground)]">{body}</p>
    </div>
  );
}
