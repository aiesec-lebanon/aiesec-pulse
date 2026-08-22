import Link from "next/link";

/**
 * A filter set that reads as text with a 2px rule under the active one, not as
 * a row of boxed chips.
 *
 * The rule the reference file settled on: a row of five filters is a
 * navigation, and navigations do not need boxes. Reserve the boxed treatment
 * for a genuinely standalone action — a Follow button — where the box is what
 * makes it look pressable in the first place.
 *
 * These are links because each state is addressable: a filtered archive has a
 * URL, so it can be shared, bookmarked and reached by the back button. A
 * button that only mutates client state would take all of that away.
 */
export function TextTabs({
  items,
  ariaLabel,
  className,
}: {
  items: Array<{ href: string; label: string; count?: number; isActive: boolean }>;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={["border-b border-[var(--hairline)]", className].filter(Boolean).join(" ")}
    >
      <ul className="-mb-px flex list-none flex-wrap items-center gap-x-7 gap-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.isActive ? "page" : undefined}
              className={[
                "pulse-label relative inline-flex min-h-[44px] items-center border-b-2 transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--primary)]",
                item.isActive
                  ? "border-[var(--primary)] text-[color:var(--foreground)]"
                  : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              ].join(" ")}
            >
              {item.label}
              {item.count !== undefined && (
                <span aria-hidden className="ml-2 opacity-60">
                  {item.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
