/**
 * Feed skeleton, matching the page's real composition: a full-bleed rotator
 * frame with an index rail, a horizontal "also today" plate rail, then the
 * elsewhere list. No page-title block — the real page doesn't render one
 * either; the rotator is the page's visual lead, and its own h1 is
 * `sr-only`.
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
    <main className="flex-1 pb-24" aria-busy="true" aria-label="Loading feed">
      {/* Rotator frame — dark, full-bleed (no border-radius, height-capped —
          matches HeroRotator exactly), with the index rail's column of dots
          down the left edge and the headline block bottom-left. */}
      <div className="relative aspect-[4/5] max-h-[min(620px,82vh)] w-full overflow-hidden bg-[#161b22] sm:aspect-[16/10] lg:aspect-[21/9] lg:max-h-[min(700px,88vh)] lg:min-h-[540px]">
        <span
          aria-hidden
          className="pulse-ambient absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)]"
          style={{ animation: "sheen-sweep 1.8s var(--ease-in-out-quint) infinite" }}
        />
        <div className="absolute inset-y-6 left-4 hidden flex-col items-center gap-3 sm:flex lg:left-8">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-[5px] w-[5px] rounded-full bg-white/25" />
          ))}
        </div>
        <div className="absolute inset-x-6 bottom-6 sm:inset-x-8 sm:bottom-[112px] lg:bottom-[156px] lg:left-28 lg:right-10">
          <div className="h-[18px] w-40 rounded-[var(--radius-sm)] bg-white/15" />
          <div className="mt-6 h-[52px] w-[92%] rounded-[var(--radius-sm)] bg-white/15 sm:w-3/4" />
          <div className="mt-3 h-[52px] w-2/3 rounded-[var(--radius-sm)] bg-white/15" />
        </div>
      </div>

      <div className="relative z-20 mx-auto w-full max-w-[1240px] px-6">
        {/* The secondary rail, overlapping the frame above it from sm: up. */}
        <div className="mt-12 sm:-mt-[96px] lg:-mt-[124px]">
          <Bone className="mb-5 h-3 w-28" />
          <div className="flex gap-5 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-[260px] shrink-0 overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-[var(--card)]"
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
        </div>

        {/* Elsewhere section */}
        <div className="mt-24 border-t border-[var(--hairline)] pt-16">
          <Bone className="mb-4 h-3 w-48" />
          <Bone className="mb-12 h-9 w-3/4 max-w-[44ch]" />
          <div className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-5 border-t border-[var(--hairline)] py-5"
              >
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
      </div>
    </main>
  );
}
