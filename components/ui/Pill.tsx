/**
 * One pill shape, not one per feature: 12px medium on a `--radius-md` corner,
 * a 10% tint of a semantic token, and its matching `-text` derivative on top.
 *
 * `StatusPill` (lifecycle) and `LevelBadge` (reach) are both this shape with a
 * different vocabulary. Anything else needing a pill uses this too.
 */
export function Pill({
  label,
  tint,
  text,
  square = false,
  className,
}: {
  label: string;
  tint: string;
  text: string;
  /**
   * Square corners. The reference file draws a *topic* as a hard-edged patch of
   * colour, not a pill — a filing mark, not a status, distinguished at a glance
   * by the corner. Lifecycle and reach badges keep the rounded shape.
   */
  square?: boolean;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center px-2 py-0.5 text-[12px] font-medium",
        square ? "rounded-none" : "rounded-[var(--radius-md)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ background: tint, color: text }}
    >
      {label}
    </span>
  );
}
