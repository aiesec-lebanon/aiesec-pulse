"use client";

import { usePathname } from "next/navigation";

/**
 * The move between two pages. Keying a wrapper on the pathname gives every
 * route change a single authored arrival.
 *
 * What is deliberately *outside* this wrapper: the header rail, the lit stage
 * behind the page, and the scroll container. A rail that re-enters with its
 * own page destroys the one fixed reference a reader navigates by, and a
 * ground that re-lights per route reads as a flicker rather than as depth.
 *
 * No `opacity`, for the reason `[data-reveal]` documents at length — an
 * opacity-hidden subtree stays in the accessibility tree and reads to every
 * contrast checker as invisible text. Travel and blur carry the arrival with
 * the real colours intact at every frame.
 *
 * One structural consequence, because it bit us and will bite the next person:
 * a `transform` or a `filter` on an ancestor makes that ancestor the
 * containing block for `position: fixed` descendants. Anything inside a page
 * that must be viewport-fixed *during* a transition therefore cannot be —
 * which is why the story page's engagement bar is `sticky`, not `fixed`. The
 * animation uses `both`, so the final frame holds `transform: none` and the
 * containing block disappears the moment it finishes.
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
