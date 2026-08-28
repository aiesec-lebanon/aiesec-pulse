import { AppShell } from "@/components/shell/AppShell";
import { getShellUser } from "@/lib/shell-user";

// Neither of the feed-mode shell props matters here: the mode dropdown they
// drive only renders under /feed, which lives in the (public) route group,
// not this one.
export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell user={await getShellUser()} feedMode="latest" feedRankedAvailable={false}>
      {children}
    </AppShell>
  );
}
