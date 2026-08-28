import { RouteTransition } from "@/components/motion/RouteTransition";
import type { FeedMode } from "@/lib/feed-mode";

import { ShellInteractive, type ShellUser } from "./ShellInteractive";

export function AppShell({
  user,
  feedMode,
  feedRankedAvailable,
  children,
}: {
  user: ShellUser | null;
  /** Read server-side so the feed nav dropdown opens already correct. */
  feedMode: FeedMode;
  feedRankedAvailable: boolean;
  children: React.ReactNode;
}) {
  return (
    // pulse-stage's glow fields are fixed pseudo-elements at z-0; content
    // needs its own stacking context above them.
    <div className="pulse-stage flex min-h-full flex-col">
      <ShellInteractive user={user} feedMode={feedMode} feedRankedAvailable={feedRankedAvailable} />
      <div
        id="main-content"
        tabIndex={-1}
        className="relative z-10 flex flex-1 flex-col scroll-mt-24 outline-none"
      >
        <RouteTransition className="flex flex-1 flex-col">{children}</RouteTransition>
      </div>
    </div>
  );
}
