/**
 * Feed skeleton, matching the page's real composition: one immersive
 * lead frame, a row of three plates, then quiet index rows.
 *
 * The shimmer is a masked sweep rather than `animate-pulse` — a whole page of
 * blocks fading in and out together reads as a fault, while a single light
 * travelling across them reads as loading. Under Reduced motion the sweep
 * stops and the bones sit still, which is the whole of the change: the
 * skeleton's job is to hold the layout, and it still does that.
 */
function Bone({ className }: { className?: string }) {
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

export default function FeedLoading() {
  return (
    <main
      className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-24"
      aria-busy="true"
      aria-label="Loading feed"
    >
      <header className="flex flex-wrap items-end justify-between gap-8 pb-8 pt-12 sm:pt-16">
        <div className="space-y-4">
          <Bone className="h-10 w-40 rounded-[var(--radius-md)]" />
          <Bone className="h-4 w-72" />
        </div>
        <Bone className="h-12 w-52 rounded-[var(--radius-md)]" />
      </header>

      {/* Lead frame */}
      <Bone className="aspect-[4/5] w-full rounded-[var(--radius-lg)] sm:aspect-[16/10] lg:aspect-[21/9]" />
      <div className="mt-4 flex items-center gap-3">
        <Bone className="h-7 w-7 rounded-full" />
        <Bone className="h-5 w-28 rounded-[var(--radius-md)]" />
        <Bone className="h-5 w-20 rounded-[var(--radius-md)]" />
        <Bone className="ml-auto h-4 w-24" />
      </div>

      {/* Plate row */}
      <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--card)]"
          >
            <Bone className="aspect-[16/10] w-full rounded-none" />
            <div className="space-y-3 p-5">
              <Bone className="h-5 w-full" />
              <Bone className="h-5 w-3/4" />
              <Bone className="mt-6 h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>

      {/* Index rows */}
      <div className="mt-24">
        <Bone className="mb-6 h-3 w-48" />
        <div className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-5 border-t border-[var(--hairline)] py-5">
              <Bone className="h-16 w-16 shrink-0 rounded-[var(--radius-md)]" />
              <div className="flex-1 space-y-2.5">
                <Bone className="h-4 w-full" />
                <Bone className="h-4 w-2/3" />
                <Bone className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
