import Link from "next/link";

/**
 * A filter set that reads as text with a 2px rule under the active one, not a
 * row of boxed chips.
 *
 * These are links, not buttons with client state: each filtered view has a
 * URL, so it can be shared, bookmarked, and reached by the back button.
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
