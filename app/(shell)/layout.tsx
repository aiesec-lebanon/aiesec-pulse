import { cookies } from "next/headers";

import { AppShell } from "@/components/shell/AppShell";
import { FEED_MODE_COOKIE, parseFeedMode } from "@/lib/feed-mode";
import { isEnabled } from "@/lib/flags";
import { getShellUser } from "@/lib/shell-user";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const [user, feedRankedAvailable, cookieStore] = await Promise.all([
    getShellUser(),
    isEnabled("feed.ranked"),
    cookies(),
  ]);
  const feedMode = feedRankedAvailable
    ? parseFeedMode(cookieStore.get(FEED_MODE_COOKIE)?.value)
    : "latest";

  return (
    <AppShell user={user} feedMode={feedMode} feedRankedAvailable={feedRankedAvailable}>
      {children}
    </AppShell>
  );
}
