/**
 * The metadata rule: entity, reading time, age, count — set in the instrument
 * register and separated by a dot.
 *
 * Every surface that lists a post carries one of these, and before this they
 * were hand-assembled per surface with three different separators and two
 * different type sizes. Falsy items are dropped, so a caller can pass an
 * optional field without composing the separators itself.
 */
export function MetaLine({
  items,
  className,
  separator = "·",
}: {
  items: Array<React.ReactNode | null | undefined | false>;
  className?: string;
  /** A slash reads as a path (breadcrumbs); the default dot reads as a list. */
  separator?: string;
}) {
  const shown = items.filter(Boolean);
  if (shown.length === 0) return null;

  return (
    <p className={["pulse-label flex flex-wrap items-center", className].filter(Boolean).join(" ")}>
      {shown.map((item, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && (
            <span aria-hidden className="px-2 opacity-60">
              {separator}
            </span>
          )}
          {item}
        </span>
      ))}
    </p>
  );
}
