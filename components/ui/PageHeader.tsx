import Link from "next/link";

import { Reveal } from "@/components/motion/Reveal";

/**
 * The page header, once.
 *
 * Eight pages had each grown their own: a "← Back to …" link at 14px muted,
 * then an `h1` at 24, 32 or 34px depending on the page, sometimes with a
 * count in a lighter weight beside it, sometimes with buttons on the right
 * and sometimes below. The result was that no two surfaces in the product
 * announced themselves the same way, which is most of why the app read as
 * assembled rather than designed.
 *
 * One shape now: a breadcrumb in the micro-label register, the title in the
 * display register, an optional standfirst at the lead-body size, and actions
 * pinned to the baseline of the title on wide viewports.
 */
export function PageHeader({
  title,
  standfirst,
  breadcrumb,
  count,
  actions,
  bordered = true,
}: {
  title: string;
  standfirst?: string;
  /** Trail from the nearest parent surface. The last entry is the current page. */
  breadcrumb?: Array<{ href?: string; label: string }>;
  count?: number;
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
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb">
            <ol className="pulse-label flex flex-wrap items-center">
              {breadcrumb.map((crumb, i) => (
                <li key={`${crumb.label}-${i}`} className="flex items-center">
                  {i > 0 && (
                    <span aria-hidden className="px-2">
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

        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <h1 className="pulse-display pulse-display-md text-[color:var(--foreground)]">
              {title}
              {count !== undefined && (
                <span className="tabular ml-3 align-middle text-[20px] font-bold tracking-normal text-[color:var(--muted-foreground)]">
                  {count}
                </span>
              )}
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
