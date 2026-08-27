/**
 * A row of measurements under a hero or a page intro: entity, date, reading
 * time, count — each a label in the instrument register over a value in the
 * display serif, divided by hairlines rather than boxed into cards.
 *
 * Cards would make four facts look like four things to click. The strip reads
 * as one instrument panel, which is what it is, and it is the reason the same
 * shape can carry a story's provenance, a topic's totals and a moderation
 * queue's counters without being redesigned each time.
 *
 * On a narrow viewport the cells stack two-up rather than scrolling: four
 * numbers squeezed onto one line stop being readable well before they stop
 * fitting.
 *
 * `contained` is what makes it line up with the rest of the app. Under a
 * full-bleed hero the strip's *rules* have to reach both page edges, but its
 * first cell must start where every other page's content starts — the shell's
 * own `max-w-[1240px]` column. Without it, the strip began at the page margin
 * while the header wordmark sat in a centred container, and on a 1920px screen
 * the two were 300px out of step.
 */
export function SpecStrip({
  cells,
  className,
  ariaLabel,
  contained = false,
}: {
  cells: Array<{ label: string; value: React.ReactNode }>;
  className?: string;
  ariaLabel?: string;
  /** Full-width rules, cells aligned to the shell's content column. */
  contained?: boolean;
}) {
  if (cells.length === 0) return null;

  const grid = (
    <>
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={[
            "min-w-0 py-5",
            contained ? "px-4 sm:px-6 sm:first:pl-0" : "px-[var(--page-x)] sm:px-6",
            // A left rule on every cell but the first in its row draws the
            // grid without doubling up against the strip's own outer border.
            i % 2 === 1 ? "border-l border-[var(--hairline)]" : "",
            "sm:border-l sm:first:border-l-0",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <dt className="pulse-label truncate">{cell.label}</dt>
          <dd className="pulse-serif pulse-serif-sm mt-1 truncate text-[color:var(--foreground)]">
            {cell.value}
          </dd>
        </div>
      ))}
    </>
  );

  if (!contained) {
    return (
      <dl
        aria-label={ariaLabel}
        className={["grid grid-cols-2 border-y border-[var(--hairline)] sm:grid-cols-4", className]
          .filter(Boolean)
          .join(" ")}
      >
        {grid}
      </dl>
    );
  }

  return (
    <div className={["border-y border-[var(--hairline)]", className].filter(Boolean).join(" ")}>
      <dl
        aria-label={ariaLabel}
        className="mx-auto grid w-full max-w-[1240px] grid-cols-2 px-6 sm:grid-cols-4"
      >
        {grid}
      </dl>
    </div>
  );
}
