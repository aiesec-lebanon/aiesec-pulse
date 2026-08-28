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
  /** Square corners — used for topic pills; lifecycle and reach badges stay rounded. */
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
