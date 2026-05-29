import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/AppShell";
import type { ShellUser } from "@/components/shell/ShellInteractive";
import { deriveRole } from "@/lib/auth/current-user";
import { UserRole } from "@/app/generated/prisma/enums";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const raw = store.get("user")?.value;
  let user: ShellUser | null = null;
  if (raw) {
    const parsed = JSON.parse(raw) as ShellUser;
    user = {
      ...parsed,
      isMcp: deriveRole(parsed.current_positions ?? []) === UserRole.MCP,
    };
  }

  return <AppShell user={user}>{children}</AppShell>;
}
