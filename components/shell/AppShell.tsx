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
      <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col scroll-mt-32">
        {children}
      </div>
    </div>
  );
}
