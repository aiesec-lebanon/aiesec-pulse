import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/AppShell";
import type { ShellUser } from "@/components/shell/ShellInteractive";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const raw = store.get("user")?.value;
  const user: ShellUser | null = raw
    ? (JSON.parse(raw) as ShellUser)
    : null;

  return <AppShell user={user}>{children}</AppShell>;
}
