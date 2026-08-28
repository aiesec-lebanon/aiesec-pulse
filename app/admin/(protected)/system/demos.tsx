"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

import { PostLevel, TopicKind } from "@/app/generated/prisma/enums";
import { TitleAccentPicker } from "@/components/composer/TitleAccentPicker";
import { HeroRotator } from "@/components/feed/HeroRotator";
import { FlipList } from "@/components/motion/FlipList";
import { Reveal } from "@/components/motion/Reveal";
import { type EntityOption, EntityTypeahead } from "@/components/ui/EntityTypeahead";
import { ReasonModal } from "@/components/ui/ReasonModal";
import type { FeedPost } from "@/types/feed";

/**
 * Live demos for `/admin/system` that need their own client-side state —
 * split out so the page itself stays a server component. Every one of these
 * uses fabricated example data, the same way the rest of the page does; none
 * of them touch a real record. Where the underlying action does exist
 * (`toggleFollow` inside `HeroRotator`'s `FollowButton`), it's guarded
 * server-side against a real target existing, so a fabricated id is a no-op.
 */

// Fixed, not `new Date()` at module scope: this file is "use client", so its
// top level runs again in the browser during hydration — a fresh timestamp
// each time is exactly the hydration-mismatch class React warns about.
const DEMO_DATE = new Date("2026-08-21T09:00:00.000Z");

export function RevealDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex items-center gap-6">
      <Reveal key={run} y={16}>
        <div className="pulse-plate flex h-16 w-40 items-center justify-center text-[14px] font-bold text-[color:var(--foreground)]">
          Watch me arrive
        </div>
      </Reveal>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="aiesec-btn-secondary shrink-0"
      >
        Replay
      </button>
    </div>
  );
}

export function PressDemo() {
  const [count, setCount] = useState(0);
  const [pressKey, setPressKey] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        setCount((c) => c + 1);
        setPressKey((k) => k + 1);
      }}
      className="group relative flex min-h-[44px] items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-4 text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:border-[var(--destructive)] hover:text-[color:var(--destructive-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      <span
        key={pressKey}
        className="pulse-burst pointer-events-none absolute inset-0"
        aria-hidden
      />
      <Heart key={`icon-${pressKey}`} size={16} strokeWidth={2} className="pulse-pop" aria-hidden />
      <span className="tabular">{count}</span>
      <span className="sr-only">React</span>
    </button>
  );
}

type FlipItem = { id: string; label: string };
const INITIAL_FLIP_ITEMS: FlipItem[] = [
  { id: "a", label: "Nairobi" },
  { id: "b", label: "Cairo" },
  { id: "c", label: "Manila" },
  { id: "d", label: "Bogotá" },
];

export function FlipListDemo() {
  const [items, setItems] = useState(INITIAL_FLIP_ITEMS);

  function shuffle() {
    setItems((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  }

  return (
    <div>
      <button type="button" onClick={shuffle} className="aiesec-btn-secondary mb-4">
        Shuffle
      </button>
      <FlipList as="ul" revision={items.map((i) => i.id).join(",")} className="flex flex-col">
        {items.map((item) => (
          <li
            key={item.id}
            data-flip-key={item.id}
            className="pulse-flip border-b border-[var(--hairline)] py-3 text-[15px] font-bold text-[color:var(--foreground)] last:border-0"
          >
            {item.label}
          </li>
        ))}
      </FlipList>
    </div>
  );
}

const DEMO_SLIDES: FeedPost[] = [
  {
    id: "demo-slide-1",
    slug: "demo-slide-1",
    title: "Four hundred volunteers rebuilt a river town",
    titleAccent: "rebuilt",
    excerpt:
      "Nine weeks, three municipal governments, and the first deployment AIESEC in Brazil has coordinated end to end since 2019.",
    readingMinutes: 6,
    level: PostLevel.NETWORK,
    mediaUrl: null,
    mediaAlt: null,
    author: {
      id: "demo-author-1",
      fullName: "Marina Alves",
      avatarUrl: null,
      entityName: "AIESEC in Brazil",
    },
    publisherEntityId: "demo-entity-1",
    entityFollowState: "none",
    reactionCount: 214,
    commentCount: 18,
    // A fixed date, not `new Date()` — this module runs client-side too (it
    // backs `HeroRotatorDemo`), and a fresh timestamp per evaluation is
    // exactly the class of hydration mismatch React warns about.
    publishedAt: DEMO_DATE,
    topics: [{ slug: "global-volunteer", name: "Global Volunteer", kind: TopicKind.PROGRAMME }],
  },
  {
    id: "demo-slide-2",
    slug: "demo-slide-2",
    title: "A regional marketing playbook, rewritten from the ground up",
    titleAccent: "rewritten",
    excerpt:
      "Six entities, one shared campaign calendar, and the first time the region has run a launch in step rather than in sequence.",
    readingMinutes: 4,
    level: PostLevel.LOCAL,
    mediaUrl: null,
    mediaAlt: null,
    author: {
      id: "demo-author-2",
      fullName: "Youssef Karam",
      avatarUrl: null,
      entityName: "AIESEC in Lebanon",
    },
    publisherEntityId: "demo-entity-2",
    entityFollowState: "none",
    reactionCount: 96,
    commentCount: 7,
    publishedAt: DEMO_DATE,
    topics: [{ slug: "marketing", name: "Marketing", kind: TopicKind.FUNCTION }],
  },
];

export function HeroRotatorDemo() {
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(true);
  return (
    <HeroRotator
      slides={DEMO_SLIDES}
      active={active}
      running={running}
      overlapping={false}
      onPick={setActive}
      onPause={() => setRunning(false)}
      onResume={() => setRunning(true)}
    />
  );
}

export function ReasonModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="aiesec-btn-secondary">
        Open example dialog
      </button>
      <ReasonModal
        key={open ? "open" : "closed"}
        open={open}
        tone="destructive"
        title="Hide this post?"
        description="This is the reference example — confirming it does nothing real."
        targetLabel="Example post title"
        reasonLabel="Reason"
        reasonHint="Record a reason of at least 5 characters."
        confirmLabel="Hide"
        pendingLabel="Hiding…"
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          setOpen(false);
          return { ok: true } as const;
        }}
      />
    </>
  );
}

const DEMO_ENTITIES: EntityOption[] = [
  { id: "demo-entity-1", name: "AIESEC in Brazil", tag: "BR" },
  { id: "demo-entity-2", name: "AIESEC in Lebanon", tag: "LB" },
  { id: "demo-entity-3", name: "AIESEC in Kuala Lumpur", tag: "MY" },
  { id: "demo-entity-4", name: "AIESEC International", tag: null },
];

async function demoEntitySearch(query: string): Promise<EntityOption[]> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const q = query.toLowerCase();
  return DEMO_ENTITIES.filter((e) => e.name.toLowerCase().includes(q));
}

export function EntityTypeaheadDemo() {
  const [value, setValue] = useState<EntityOption | null>(null);
  return (
    <EntityTypeahead
      value={value}
      onChange={setValue}
      search={demoEntitySearch}
      label="Entity"
      placeholder="Search offices…"
    />
  );
}

export function TitleAccentPickerDemo() {
  const [value, setValue] = useState("rebuilt");
  return (
    <TitleAccentPicker
      title="Four hundred volunteers rebuilt a river town"
      value={value}
      onChange={setValue}
      topicKind={TopicKind.PROGRAMME}
    />
  );
}
