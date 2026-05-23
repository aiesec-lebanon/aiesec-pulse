import { ShellInteractive, type ShellUser } from "./ShellInteractive";

export function AppShell({
  user,
  children,
}: {
  user: ShellUser | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <ShellInteractive user={user} />
      {children}
    </div>
  );
}
