/**
 * The status-pill shape from design system §10.7a, as one element rather than
 * one per feature: 12px medium on a `--radius-md` corner, a 10% tint of a
 * semantic token, and the matching `-text` derivative (§3.3) on top.
 *
 * `StatusPill` (lifecycle) and `LevelBadge` (reach) are both this shape with a
 * different vocabulary. Anything else that needs a pill uses this too — §11's
 * "no second copy" rule is what the extraction is for.
 */
export function Pill({
  label,
  tint,
  text,
  className,
}: {
  label: string;
  tint: string;
  text: string;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-[var(--radius-md)] px-2 py-0.5 text-[12px] font-medium",
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
