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
 */
export function SpecStrip({
  cells,
  className,
  ariaLabel,
}: {
  cells: Array<{ label: string; value: React.ReactNode }>;
  className?: string;
  ariaLabel?: string;
}) {
  if (cells.length === 0) return null;

  return (
    <dl
      aria-label={ariaLabel}
      className={["grid grid-cols-2 border-y border-[var(--hairline)] sm:grid-cols-4", className]
        .filter(Boolean)
        .join(" ")}
    >
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={[
            "min-w-0 px-[var(--page-x)] py-5 sm:px-6",
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
    </dl>
  );
}
