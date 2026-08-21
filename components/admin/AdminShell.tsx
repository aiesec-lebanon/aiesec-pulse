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
  { href: "/admin/roles", label: "Permissions", section: "roles" },
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
    <div className="pulse-stage flex min-h-screen flex-col">
      <header className="pulse-rail relative z-30 flex h-16 flex-shrink-0 items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] md:hidden"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={sidebarOpen}
          >
            {/* Three rules that fold into a cross. The transform is the state
                change — an icon swap would read as a different button. */}
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden
                className="block h-0.5 w-5 origin-center bg-[var(--foreground)] transition-[transform,opacity] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]"
                style={
                  sidebarOpen
                    ? i === 1
                      ? { opacity: 0 }
                      : {
                          transform: `rotate(${i === 0 ? 45 : -45}deg) translateY(${i === 0 ? 7 : -7}px)`,
                        }
                    : undefined
                }
              />
            ))}
          </button>

          <span className="whitespace-nowrap text-[14px] font-bold text-[color:var(--foreground)] sm:text-[16px]">
            Pulse
            <span aria-hidden className="px-2 text-[color:var(--muted-foreground)]">
              /
            </span>
            Moderation
          </span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-4">
          <span className="hidden max-w-[200px] truncate text-[14px] text-[color:var(--muted-foreground)] sm:block">
            {userName}
          </span>
          <Link
            href="/feed"
            className="pulse-underline rounded-[var(--radius-sm)] text-[14px] font-medium text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            Back to feed
          </Link>
        </div>
      </header>

      <div className="relative flex flex-1">
        <div
          aria-hidden
          onClick={() => setSidebarOpen(false)}
          className={[
            "fixed inset-0 z-20 bg-black/50 transition-opacity duration-[calc(var(--dur-element)*var(--motion-scale))] md:hidden",
            sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
        />

        {/* One nav list rendered into two shells. It used to be written out
            twice, so a change to the active state or the count badge had to be
            made in both places or the two viewports drifted apart. */}
        <nav
          aria-label="Admin navigation"
          inert={!sidebarOpen}
          className={[
            "fixed bottom-0 left-0 top-16 z-30 flex w-64 flex-col overflow-y-auto border-r border-[var(--hairline)] bg-[var(--card)] py-4 transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] md:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <p className="pulse-label mb-2 truncate border-b border-[var(--hairline)] px-4 pb-3">
            {userName}
          </p>
          <AdminNavList items={items} onNavigate={() => setSidebarOpen(false)} />
        </nav>

        <nav
          aria-label="Admin navigation"
          className="hidden w-60 flex-shrink-0 flex-col border-r border-[var(--hairline)] bg-[var(--card)] py-4 md:flex"
        >
          <AdminNavList items={items} />
        </nav>

        <div className="min-w-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

type AdminNavItem = { href: string; label: string; badge?: number; isActive: boolean };

function AdminNavList({ items, onNavigate }: { items: AdminNavItem[]; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={item.isActive ? "page" : undefined}
            className={[
              "relative flex min-h-[44px] items-center justify-between gap-2 px-4 py-2.5 text-[15px] transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--primary)]",
              item.isActive
                ? "bg-[color-mix(in_srgb,var(--primary)_9%,transparent)] font-bold text-[color:var(--foreground)]"
                : "font-medium text-[color:var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={[
                "absolute inset-y-0 left-0 w-0.5 origin-top bg-[var(--primary)] transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]",
                item.isActive ? "scale-y-100" : "scale-y-0",
              ].join(" ")}
            />
            <span>{item.label}</span>
            {item.badge != null && (
              <span className="tabular inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--primary-fill)] px-1.5 text-[12px] font-bold text-[color:var(--primary-foreground)]">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
