import Link from "next/link";

import { Reveal } from "@/components/motion/Reveal";

/**
 * The page header, once.
 *
 * Eight pages had each grown their own: a back link at 14px muted, then an
 * `h1` at 24, 32 or 34px depending on the page, sometimes with a count beside
 * it and sometimes with buttons below. No two surfaces announced themselves
 * the same way, which is most of why the app read as assembled rather than
 * designed.
 *
 * One shape: a breadcrumb in the instrument register, the title in the display
 * serif, an optional standfirst at lead-body size, and actions pinned to the
 * baseline of the title on wide viewports. The count sits in the mono register
 * beside the breadcrumb rather than trailing the title — a serif title with a
 * sans numeral hung off it was the one thing in the old header that never
 * looked deliberate.
 */
export function PageHeader({
  title,
  standfirst,
  breadcrumb,
  count,
  countLabel,
  actions,
  bordered = true,
}: {
  title: string;
  standfirst?: string;
  /** Trail from the nearest parent surface. The last entry is the current page. */
  breadcrumb?: Array<{ href?: string; label: string }>;
  count?: number;
  /** What the count counts. Without it the number is a bare figure. */
  countLabel?: string;
  actions?: React.ReactNode;
  bordered?: boolean;
}) {
  return (
    <header
      className={["pb-8 pt-12 sm:pt-16", bordered ? "border-b border-[var(--hairline)]" : ""].join(
        " "
      )}
    >
      <Reveal y={16}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          {breadcrumb && breadcrumb.length > 0 && (
            <nav aria-label="Breadcrumb">
              <ol className="pulse-label pulse-label-wide flex flex-wrap items-center">
                {breadcrumb.map((crumb, i) => (
                  <li key={`${crumb.label}-${i}`} className="flex items-center">
                    {i > 0 && (
                      <span aria-hidden className="px-2 opacity-60">
                        /
                      </span>
                    )}
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="pulse-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-[color:var(--foreground)]" aria-current="page">
                        {crumb.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {count !== undefined && (
            <p className="pulse-label">
              {count} {countLabel ?? ""}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <h1 className="pulse-serif pulse-serif-md break-words text-[color:var(--foreground)]">
              {title}
            </h1>
            {standfirst && (
              <p className="mt-3 max-w-[56ch] text-[17px] leading-[1.55] text-[color:var(--muted-foreground)]">
                {standfirst}
              </p>
            )}
          </div>

          {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
        </div>
      </Reveal>
    </header>
  );
}
