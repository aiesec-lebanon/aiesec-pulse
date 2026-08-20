import { ShellInteractive, type ShellUser } from "./ShellInteractive";

export function AppShell({
  user,
  children,
}: {
  user: ShellUser | null;
  children: React.ReactNode;
}) {
  return (
    // `pulse-stage` paints the lit ground the whole app sits on; its glow
    // fields are `position: fixed` pseudo-elements at z-0, so content needs a
    // stacking context above them.
    <div className="pulse-stage flex min-h-full flex-col">
      <ShellInteractive user={user} />
      <div
        id="main-content"
        tabIndex={-1}
        className="relative z-10 flex flex-1 flex-col scroll-mt-24 outline-none"
      >
        {children}
      </div>
    </div>
  );
}
