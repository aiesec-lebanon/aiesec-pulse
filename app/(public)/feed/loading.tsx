function Bone({ className }: { className: string }) {
  return <div className={`rounded bg-[var(--border)] ${className}`} />;
}

export default function FeedLoading() {
  return (
    <main
      className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-10"
      aria-busy="true"
      aria-label="Loading feed"
    >
      {/* ── PRIMARY ROW ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 animate-pulse">
        {/* HERO SKELETON — 8 cols */}
        <div className="lg:col-span-8 space-y-0">
          {/* Image */}
          <Bone className="aspect-[4/3] sm:aspect-video w-full rounded-[20px]" />

          {/* Meta row */}
          <div className="mt-4 flex items-center gap-2.5">
            <Bone className="h-10 w-10 shrink-0 rounded-full" />
            <Bone className="h-3 w-28" />
            <Bone className="h-3 w-20" />
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <Bone className="h-3 w-10" />
              <Bone className="h-3 w-10" />
              <Bone className="h-3 w-14" />
            </div>
          </div>

          {/* Headline — two lines at large size */}
          <div className="mt-3 space-y-2.5">
            <Bone className="h-9 w-full" />
            <Bone className="h-9 w-3/4" />
          </div>

          {/* Excerpt */}
          <div className="mt-3 space-y-2">
            <Bone className="h-[18px] w-full" />
            <Bone className="h-[18px] w-full" />
            <Bone className="h-[18px] w-2/3" />
          </div>

          {/* CTA */}
          <Bone className="mt-4 h-4 w-24" />
        </div>

        {/* SIDEBAR SKELETONS — 4 cols, 3 items */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4 p-4">
              <Bone className="h-24 w-24 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2 py-1">
                <Bone className="h-3.5 w-full" />
                <Bone className="h-3.5 w-4/5" />
                <Bone className="mt-3 h-3 w-1/2" />
                <Bone className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECONDARY ROW — 3 cards ──────────────────────────────────────────── */}
      <section className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
          >
            <Bone className="aspect-[4/3] w-full rounded-none" />
            <div className="p-4 space-y-2">
              <Bone className="h-[18px] w-full" />
              <Bone className="h-[18px] w-3/4" />
              <div className="mt-3 flex items-center gap-2">
                <Bone className="h-3 w-1/2" />
                <div className="ml-auto flex gap-3">
                  <Bone className="h-3 w-8" />
                  <Bone className="h-3 w-8" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── TRENDING AUTHORS STRIP ───────────────────────────────────────────── */}
      <section className="mt-12 animate-pulse">
        <Bone className="mb-4 h-4 w-40" />
        <div className="flex gap-4 overflow-hidden pb-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-80 shrink-0 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 space-y-3"
            >
              <div className="flex items-center gap-3">
                <Bone className="h-12 w-12 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Bone className="h-3.5 w-3/4" />
                  <Bone className="h-3 w-1/2" />
                </div>
              </div>
              <Bone className="h-6 w-1/2 rounded-[var(--radius-md)]" />
            </div>
          ))}
        </div>
      </section>

      {/* ── LOAD MORE stub ───────────────────────────────────────────────────── */}
      <div className="mt-12 flex justify-center animate-pulse">
        <Bone className="h-10 w-28 rounded-[var(--radius-sm)]" />
      </div>
    </main>
  );
}
