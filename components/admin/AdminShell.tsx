"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type AdminSections = {
  queue: boolean;
  posts: boolean;
  comments: boolean;
  activity: boolean;
  audit: boolean;
  roles: boolean;
  privacy: boolean;
  flags: boolean;
};

const NAV_ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  section: keyof AdminSections;
  queueBadge?: boolean;
}> = [
  { href: "/admin/queue", label: "Approval queue", section: "queue", queueBadge: true },
  { href: "/admin/posts", label: "All posts", section: "posts" },
  { href: "/admin/comments", label: "Comments", section: "comments" },
  { href: "/admin/activity", label: "Publishing activity", section: "activity" },
  { href: "/admin/audit", label: "Audit log", section: "audit" },
  { href: "/admin/roles", label: "Roles & grants", section: "roles" },
  { href: "/admin/privacy", label: "Data requests", section: "privacy" },
  { href: "/admin/flags", label: "Feature flags", section: "flags" },
];

interface AdminShellProps {
  userName: string;
  queuedCount: number;
  sections: AdminSections;
  children: React.ReactNode;
}

export function AdminShell({ userName, queuedCount, sections, children }: AdminShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const items = NAV_ITEMS.filter((item) => sections[item.section]).map((item) => ({
    href: item.href,
    label: item.label,
    badge: item.queueBadge && queuedCount > 0 ? queuedCount : undefined,
    isActive: pathname === item.href || pathname.startsWith(item.href + "/"),
  }));

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top bar: 64px ─────────────────────────────────────────────────── */}
      <header className="h-16 flex-shrink-0 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 gap-2 z-30 relative">
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px] flex-shrink-0 rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-colors"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={sidebarOpen}
          >
            <span
              className={[
                "block w-5 h-0.5 bg-[var(--foreground)] transition-all duration-200 origin-center",
                sidebarOpen ? "rotate-45 translate-y-[7px]" : "",
              ].join(" ")}
            />
            <span
              className={[
                "block w-5 h-0.5 bg-[var(--foreground)] transition-all duration-200",
                sidebarOpen ? "opacity-0" : "",
              ].join(" ")}
            />
            <span
              className={[
                "block w-5 h-0.5 bg-[var(--foreground)] transition-all duration-200 origin-center",
                sidebarOpen ? "-rotate-45 -translate-y-[7px]" : "",
              ].join(" ")}
            />
          </button>

          <span className="text-[14px] sm:text-[16px] font-bold text-foreground whitespace-nowrap">
            AIESEC Pulse · Moderation
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="hidden sm:block text-[14px] text-muted-foreground truncate max-w-[200px]">
            {userName}
          </span>
          <Link
            href="/feed"
            className="text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to feed
          </Link>
        </div>
      </header>

      {/* ── Body: left rail + page content ────────────────────────────────── */}
      <div className="flex flex-1 relative">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile slide-in sidebar */}
        <nav
          className={[
            "fixed top-16 left-0 bottom-0 w-64 z-30 bg-[var(--card)] border-r border-[var(--border)] py-4 flex flex-col transition-transform duration-200 md:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
          aria-label="Admin navigation"
        >
          <div className="px-4 pb-3 mb-1 border-b border-[var(--border)]">
            <p className="text-[12px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide truncate">
              {userName}
            </p>
          </div>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={[
                "flex items-center justify-between px-4 py-3 text-[15px] transition-colors border-l-2",
                item.isActive
                  ? "border-primary bg-muted font-bold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground hover:bg-muted",
              ].join(" ")}
            >
              <span>{item.label}</span>
              {item.badge != null && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-[var(--primary-fill)] text-[var(--primary-foreground)] text-[12px] font-bold px-1.5 tabular-nums">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Desktop left rail — 240px */}
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
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-[var(--primary-fill)] text-[var(--primary-foreground)] text-[12px] font-bold px-1.5 tabular-nums">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Page content */}
        <div className="flex-1 min-w-0 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
