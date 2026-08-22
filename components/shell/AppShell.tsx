import type { FeedMode } from "@/lib/feed-mode";

import { ShellInteractive, type ShellUser } from "./ShellInteractive";

export function AppShell({
  user,
  feedMode,
  feedRankedAvailable,
  children,
}: {
  user: ShellUser | null;
  /** The feed's own For You / Latest choice, read server-side so the nav's
   *  dropdown (rendered while pathname is under /feed) opens already correct. */
  feedMode: FeedMode;
  feedRankedAvailable: boolean;
  children: React.ReactNode;
}) {
  return (
    // `pulse-stage` paints the lit ground the whole app sits on; its glow
    // fields are `position: fixed` pseudo-elements at z-0, so content needs a
    // stacking context above them.
    <div className="pulse-stage flex min-h-full flex-col">
      <ShellInteractive user={user} feedMode={feedMode} feedRankedAvailable={feedRankedAvailable} />
      <div
        id="main-content"
        tabIndex={-1}
        className="relative z-10 flex flex-1 flex-col scroll-mt-24 outline-none"
      >
        {children}
      </div>
    </div>
  );
}
