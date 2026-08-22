import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetaLine } from "@/components/ui/MetaLine";
import { SpecStrip } from "@/components/ui/SpecStrip";
import { TextTabs } from "@/components/ui/TextTabs";
import { TopicLabel, TopicPill } from "@/components/ui/TopicPill";
import { TopicPlate } from "@/components/ui/TopicPlate";
import { requireAdmin } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

/**
 * The design system, rendered rather than described.
 *
 * A written specification drifts from the code the week after it is written;
 * this page cannot, because it is built out of the same components every other
 * screen uses. Look at it in both themes before starting a refactor, and again
 * after — anything that changed here changed everywhere.
 */
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
      </Section>

      <Section n="03" title="Spec strip">
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

      <Section n="04" title="Text tabs">
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

      <Section n="05" title="Topic plate">
        <p className="mb-5 max-w-[62ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          What a post shows when it has no cover, which is most posts: the publishing entity&apos;s
          initials on a field of its topic&apos;s colour.
        </p>
        <div className="grid grid-cols-1 gap-px bg-[var(--hairline)] sm:grid-cols-3">
          <div className="aspect-[16/10]">
            <TopicPlate entityName="AIESEC in Brazil" kind="PROGRAMME" />
          </div>
          <div className="aspect-[16/10]">
            <TopicPlate entityName="AIESEC in Kuala Lumpur" kind="FUNCTION" />
          </div>
          <div className="aspect-[16/10]">
            <TopicPlate entityName="AIESEC International" kind="GENERAL" />
          </div>
        </div>
      </Section>

      <Section n="06" title="Empty and error states">
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
