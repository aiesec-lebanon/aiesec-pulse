/**
 * Measurements under a hero, labels over values, divided by hairlines.
 * `contained` keeps the rules full-bleed while aligning cells to the
 * shell's max-w-[1240px] column — without it the strip drifted ~300px
 * out of step with the header on wide screens.
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
            // Left rule on all but each row's first cell, to avoid doubling
            // the strip's outer border.
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
