"use client";

import { usePathname } from "next/navigation";

/**
 * Keyed on pathname for one arrival per route change. Header rail, stage,
 * and scroll container stay outside this wrapper, or re-entering them per
 * page breaks the reader's one fixed reference point. Animates
 * transform/blur, not opacity, so contrast checkers don't read a
 * transitioning subtree as invisible text — and because transform/filter
 * becomes the containing block for `position: fixed`, anything needing
 * viewport-fixed positioning mid-transition must be `sticky` instead.
 */
export function RouteTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div key={pathname} className={["pulse-route", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
