"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminLogout } from "@/app/actions/admin";

const NAV_ITEMS = [
  { href: "/admin/queue", label: "Queue", queueBadge: true },
  { href: "/admin/posts", label: "All posts" },
  { href: "/admin/comments", label: "Comments" },
  { href: "/admin/activity", label: "MCP activity" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

interface AdminShellProps {
  adminEmail: string;
  pendingCount: number;
  children: React.ReactNode;
}

export function AdminShell({ adminEmail, pendingCount, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const items = NAV_ITEMS.map((item) => ({
    href: item.href,
    label: item.label,
    badge: "queueBadge" in item && pendingCount > 0 ? pendingCount : undefined,
    isActive:
      pathname === item.href || pathname.startsWith(item.href + "/"),
  }));

  const currentItem = items.find((i) => i.isActive);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top bar: 64px ─────────────────────────────────────────────────── */}
      <header className="h-16 flex-shrink-0 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <span className="text-[14px] sm:text-[16px] font-bold text-foreground whitespace-nowrap">
            AIESEC News · Moderator
          </span>

          {/* Mobile-only section select (hidden on md+) */}
          <select
            className="md:hidden h-8 rounded-[var(--radius-sm)] border border-border bg-card text-[14px] text-foreground px-2 cursor-pointer"
            value={currentItem?.href ?? "/admin/queue"}
            onChange={(e) => router.push(e.target.value)}
            aria-label="Navigate admin sections"
          >
            {items.map((item) => (
              <option key={item.href} value={item.href}>
                {item.label}
                {item.badge != null ? ` (${item.badge})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="hidden sm:block text-[14px] text-muted-foreground truncate max-w-[200px]">
            {adminEmail}
          </span>
          <form action={adminLogout}>
            <button
              type="submit"
              className="text-[14px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* ── Body: left rail + page content ────────────────────────────────── */}
      <div className="flex flex-1">
        {/* Left rail — 240px, desktop only */}
        <nav
          className="hidden md:flex flex-col w-60 flex-shrink-0 border-r border-border bg-card py-4"
          aria-label="Admin navigation"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center justify-between px-4 py-2.5 text-[15px] transition-colors border-l-2",
                item.isActive
                  ? "border-primary bg-muted font-bold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground hover:bg-muted",
              ].join(" ")}
            >
              <span>{item.label}</span>
              {item.badge != null && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground text-[12px] font-bold px-1.5 tabular-nums">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Page content */}
        <div className="flex-1 min-w-0 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
