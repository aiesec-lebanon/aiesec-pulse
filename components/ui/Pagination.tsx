import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Feed / search / topic-archive pagination, as one component.
 *
 * The same Newer/Older markup had been copy-pasted into three pages with
 * three different `aria-label`s and three chances to drift. Plain `<a>`
 * elements, not `<Link>`: these are full navigations that must reset scroll
 * and re-run the server component, and each caller already computes its own
 * hrefs because the query-string shape differs per surface.
 */
export function Pagination({
  label,
  page,
  hasNext,
  previousHref,
  nextHref,
}: {
  /** Names the region, e.g. "Feed pagination". */
  label: string;
  page: number;
  hasNext: boolean;
  previousHref: string | null;
  nextHref: string | null;
}) {
  if (!previousHref && !nextHref) return null;

  return (
    <nav aria-label={label} className="mt-16 flex items-center justify-center gap-3">
      {previousHref ? (
        <PageLink href={previousHref} direction="previous">
          Newer
        </PageLink>
      ) : (
        <span className="w-[124px]" aria-hidden />
      )}

      <span className="tabular select-none px-2 text-[13px] text-[color:var(--muted-foreground)]">
        Page {page}
      </span>

      {hasNext && nextHref ? (
        <PageLink href={nextHref} direction="next">
          Older
        </PageLink>
      ) : (
        <span className="w-[124px]" aria-hidden />
      )}
    </nav>
  );
}

function PageLink({
  href,
  direction,
  children,
}: {
  href: string;
  direction: "previous" | "next";
  children: React.ReactNode;
}) {
  const Icon = direction === "previous" ? ArrowLeft : ArrowRight;
  return (
    <a
      href={href}
      rel={direction}
      className="group inline-flex min-h-[44px] w-[124px] items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--card)] px-5 text-[15px] font-bold text-[color:var(--foreground)] shadow-[var(--elev-1)] transition-[color,border-color,box-shadow,transform] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] hover:-translate-y-[calc(2px*var(--motion-travel))] hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] hover:text-[color:var(--primary-text)] hover:shadow-[var(--elev-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      {direction === "previous" && (
        <Icon
          size={15}
          strokeWidth={2.5}
          aria-hidden
          className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:-translate-x-[calc(3px*var(--motion-travel))]"
        />
      )}
      {children}
      {direction === "next" && (
        <Icon
          size={15}
          strokeWidth={2.5}
          aria-hidden
          className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:translate-x-[calc(3px*var(--motion-travel))]"
        />
      )}
    </a>
  );
}
