import type { FeedPost } from "@/types/feed";
import { HeroPostCard } from "@/components/posts/HeroPostCard";
import { SidebarPostCard } from "@/components/posts/SidebarPostCard";
import { SecondaryPostCard } from "@/components/posts/SecondaryPostCard";
import { CompactPostCard } from "@/components/posts/CompactPostCard";

// ── Sample fixtures ────────────────────────────────────────────────────────────

const SHORT: FeedPost = {
  id: "preview-short",
  title: "Lebanon MC wins best entity award",
  excerpt: "An incredible journey of resilience and growth.",
  mediaUrl: null,
  author: {
    id: "a1",
    fullName: "Geeneth P",
    avatarUrl: null,
    committeeName: "Lebanon",
  },
  likeCount: 14,
  commentCount: 3,
  createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
};

const LONG: FeedPost = {
  id: "preview-long",
  title:
    "How the Lebanese MC overcame every obstacle this year and came out stronger than ever, setting a new standard for all AIESEC entities worldwide",
  excerpt:
    "This has been a year unlike any other for the Lebanese Member Committee. Faced with unprecedented challenges — from economic instability to logistical setbacks — the team refused to give up. Instead, they rallied together, innovated on every front, and produced outcomes that exceeded all expectations. Here is the full story of what happened and why it matters for every AIESEC entity around the world.",
  mediaUrl: null,
  author: {
    id: "a2",
    fullName: "Alexandra Konstantinopoulou",
    avatarUrl: null,
    committeeName: "Greece · Athens Local Committee",
  },
  likeCount: 248,
  commentCount: 61,
  createdAt: new Date("2026-03-14"),
};

const IMAGE_URL = "https://picsum.photos/seed/aiesec/800/600";

const SHORT_WITH_IMAGE: FeedPost = {
  ...SHORT,
  id: "preview-short-img",
  mediaUrl: IMAGE_URL,
};

const LONG_WITH_IMAGE: FeedPost = {
  ...LONG,
  id: "preview-long-img",
  mediaUrl: IMAGE_URL,
};

// ── Layout helpers ─────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="mb-5 border-b border-[var(--border)] pb-2 text-[12px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
      {children}
    </p>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DesignPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10">

      {/* ── Internal preview banner ─────────────────────────────────────────── */}
      <div
        role="alert"
        className="mb-10 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--destructive)] bg-[var(--destructive)]/10 px-5 py-3 text-[14px] font-bold text-[var(--destructive)]"
      >
        <span aria-hidden>⚠</span>
        Internal preview — remove before launch.
      </div>

      <h1 className="text-[28px] font-black text-[var(--foreground)]">
        Post Card Variants
      </h1>
      <p className="mt-2 text-[16px] text-[var(--muted-foreground)]">
        Visual catalog showing all four variants with short and very-long
        content, and with / without media. Avatars and image fallbacks are
        tested in every case.
      </p>

      {/* ── HeroPostCard ──────────────────────────────────────────────────── */}
      <Section title="HeroPostCard — image top, large headline, excerpt, CTA">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <Label>Short content · no image</Label>
            <HeroPostCard post={SHORT} />
          </div>
          <div>
            <Label>Short content · with image</Label>
            <HeroPostCard post={SHORT_WITH_IMAGE} />
          </div>
          <div>
            <Label>Long content · no image</Label>
            <HeroPostCard post={LONG} />
          </div>
          <div>
            <Label>Long content · with image</Label>
            <HeroPostCard post={LONG_WITH_IMAGE} />
          </div>
        </div>
      </Section>

      {/* ── SidebarPostCard ───────────────────────────────────────────────── */}
      <Section title="SidebarPostCard — horizontal, thumbnail left">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <SidebarPostCard post={SHORT} />
          <SidebarPostCard post={LONG} />
          <SidebarPostCard post={SHORT_WITH_IMAGE} />
          <SidebarPostCard post={LONG_WITH_IMAGE} />
        </div>
      </Section>

      {/* ── SecondaryPostCard ─────────────────────────────────────────────── */}
      <Section title="SecondaryPostCard — image top, compact headline + meta">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <SecondaryPostCard post={SHORT} />
          <SecondaryPostCard post={LONG} />
          <SecondaryPostCard post={SHORT_WITH_IMAGE} />
          <SecondaryPostCard post={LONG_WITH_IMAGE} />
        </div>
      </Section>

      {/* ── CompactPostCard ───────────────────────────────────────────────── */}
      <Section title="CompactPostCard — text-only, thin top border">
        <div className="max-w-lg">
          <CompactPostCard post={SHORT} />
          <CompactPostCard post={LONG} />
          <CompactPostCard
            post={{
              ...SHORT,
              id: "preview-compact-nc",
              author: { ...SHORT.author, committeeName: null },
            }}
          />
          <CompactPostCard
            post={{
              ...LONG,
              id: "preview-compact-long-nc",
              author: { ...LONG.author, committeeName: null },
            }}
          />
        </div>
      </Section>

      {/* Bottom spacer */}
      <div className="mt-24" />
    </main>
  );
}
