import { AppShell } from "@/components/shell/AppShell";
import { getShellUser } from "@/lib/shell-user";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  return <AppShell user={await getShellUser()}>{children}</AppShell>;
}
