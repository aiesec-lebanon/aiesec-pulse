import { AppShell } from "@/components/shell/AppShell";
import type { ShellUser } from "@/components/shell/ShellInteractive";
import { getOrSyncUser } from "@/lib/auth/current-user";
import { UserRole } from "@/app/generated/prisma/enums";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dbUser = await getOrSyncUser();
  const user: ShellUser | null = dbUser
    ? {
        full_name: dbUser.fullName,
        committeeName: dbUser.committeeName ?? undefined,
        isMcp: dbUser.role === UserRole.MCP,
      }
    : null;

  return <AppShell user={user}>{children}</AppShell>;
}
