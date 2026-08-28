import { AppShell } from "@/components/shell/AppShell";
import { getShellUser } from "@/lib/shell-user";

// feedMode/feedRankedAvailable are unused here: that dropdown only renders
// under /feed, in the (public) route group.
export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell user={await getShellUser()} feedMode="latest" feedRankedAvailable={false}>
      {children}
    </AppShell>
  );
}
