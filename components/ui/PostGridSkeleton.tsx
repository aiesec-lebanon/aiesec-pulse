/**
 * The shimmer bones shared by every page whose loading state is "a
 * PageHeader, maybe a SpecStrip, then a grid of SecondaryPostCards" —
 * search, bookmarks, a topic archive, an author or entity profile. One file
 * rather than five near-identical loading.tsx bodies, each a chance to drift
 * from what its own page actually renders.
 */
export function Bone({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[var(--radius-sm)] bg-[var(--border)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden
        className="pulse-ambient absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--card)_55%,transparent),transparent)]"
        style={{ animation: "sheen-sweep 1.6s var(--ease-in-out-quint) infinite" }}
      />
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="border-b border-[var(--hairline)] pb-8 pt-12 sm:pt-16">
      <Bone className="mb-5 h-3 w-40" />
      <Bone className="h-11 w-2/3 max-w-[26ch]" />
      <Bone className="mt-4 h-4 w-full max-w-[52ch]" />
    </div>
  );
}

export function SpecStripSkeleton() {
  return (
    <div className="mt-10 grid grid-cols-2 border-y border-[var(--hairline)] sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="min-w-0 px-[var(--page-x)] py-5 sm:px-6">
          <Bone className="h-2.5 w-16" />
          <Bone className="mt-2 h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-[var(--card)]"
        >
          <Bone className="h-[150px] w-full rounded-none" />
          <div className="space-y-2.5 p-4 pb-[18px]">
            <Bone className="h-3 w-1/2" />
            <Bone className="h-5 w-full" />
            <Bone className="mt-3 h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PostGridPageSkeleton({
  count = 6,
  withSpecStrip = false,
}: {
  count?: number;
  withSpecStrip?: boolean;
}) {
  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-24" aria-busy="true">
      <HeaderSkeleton />
      {withSpecStrip && <SpecStripSkeleton />}
      <CardGridSkeleton count={count} />
    </main>
  );
}

/**
 * A hairline index — the shape the bookmarks list and both profile surfaces
 * load into now that none of them is a card grid. Two-line title bones on a
 * ruled row, with a leading square where a thumbnail sits.
 */
export function IndexRowsSkeleton({
  count = 5,
  withThumb = true,
}: {
  count?: number;
  withThumb?: boolean;
}) {
  return (
    <div className="mt-4 flex flex-col border-t border-[var(--hairline)]">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-5 border-b border-[var(--hairline)] py-6">
          {withThumb ? (
            <Bone className="h-16 w-16 shrink-0 rounded-none" />
          ) : (
            <Bone className="h-7 w-8 shrink-0" />
          )}
          <div className="min-w-0 flex-1 space-y-2.5">
            <Bone className="h-5 w-4/5" />
            <Bone className="h-3 w-1/3" />
          </div>
          <Bone className="hidden h-3 w-20 shrink-0 sm:block" />
        </div>
      ))}
    </div>
  );
}

/**
 * The 4a profile composition, as bones: the angled hero, the four-cell stat
 * strip, and the index rail beside a column of ruled rows. Shared by
 * `/profile`, `/authors/[id]` and `/entities/[id]`, which now render the same
 * layout — three loading files that drift apart is exactly what this file
 * exists to prevent.
 */
export function ProfilePageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <main className="flex-1 pb-24" aria-busy="true">
      <div className="relative h-[clamp(280px,42vw,540px)] overflow-hidden bg-[var(--card)]">
        <span
          aria-hidden
          className="pulse-ambient absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--background)_60%,transparent),transparent)]"
          style={{ animation: "sheen-sweep 1.8s var(--ease-in-out-quint) infinite" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[var(--background)]"
          style={{ clipPath: "polygon(100% 0, 100% 100%, 58% 100%, 74% 0)" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[color-mix(in_srgb,var(--primary)_22%,var(--card))]"
          style={{ clipPath: "polygon(100% 0, 100% 100%, 48% 100%, 66% 0)" }}
        />
        <div className="absolute left-[var(--page-x)] right-[52%] top-[22%] space-y-5">
          <Bone className="h-3 w-40" />
          <Bone className="h-12 w-full" />
          <Bone className="h-4 w-3/4" />
        </div>
      </div>

      <SpecStripSkeleton />

      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-start gap-12 px-6 pt-14 lg:grid-cols-[230px_minmax(0,1fr)]">
        <div className="hidden space-y-3 lg:block">
          <Bone className="h-3 w-32" />
          {[0, 1, 2].map((i) => (
            <Bone key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="min-w-0 max-w-[860px]">
          <Bone className="h-7 w-40" />
          <IndexRowsSkeleton count={rows} withThumb={false} />
        </div>
      </div>
    </main>
  );
}
