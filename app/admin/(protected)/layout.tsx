import Link from "next/link";
import { adminLogout } from "@/app/actions/admin";

const navLinks = [
  { href: "/admin/queue", label: "Queue" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/comments", label: "Comments" },
  { href: "/admin/activity", label: "Activity" },
];

export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1200px] px-6 h-14 flex items-center justify-between">
          <nav className="flex items-center gap-1">
            <span className="text-[15px] font-bold text-foreground mr-4">
              Moderator
            </span>
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-[var(--radius-md)] text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>

          <form action={adminLogout}>
            <button
              type="submit"
              className="text-[14px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1200px] px-6 py-8">
        {children}
      </main>
    </div>
  );
}
