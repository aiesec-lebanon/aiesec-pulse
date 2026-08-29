/**
 * Metadata rule (entity, reading time, age, count) joined by a dot.
 * Falsy items are dropped, so callers can pass optional fields directly.
 */
export function MetaLine({
  items,
  className,
  separator = "·",
}: {
  items: Array<React.ReactNode | null | undefined | false>;
  className?: string;
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
