"use client";

import { ChevronDown, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";

// Capability flags, not roles: hiding a control is a courtesy, never a
// boundary. The authoritative check stays in the Server Action.

export type ShellUser = {
  fullName: string;
  entityName: string | null;
  canPublish: boolean;
  canModerate: boolean;
  canAdminister: boolean;
  searchEnabled: boolean;
};

export function ShellInteractive({ user }: { user: ShellUser | null }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);

  const initials = user?.fullName
    ? user.fullName
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  useEffect(() => {
    if (!dropdownOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [dropdownOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (dropdownOpen) {
        setDropdownOpen(false);
        triggerRef.current?.focus();
      } else if (drawerOpen) {
        setDrawerOpen(false);
        drawerTriggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dropdownOpen, drawerOpen]);

  // The drawer is `aria-modal`, so focus must not escape it while it is open —
  // otherwise a screen-reader user tabs into content the dialog claims to cover.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    if (!drawerOpen) return;

    const panel = drawerRef.current;
    panel?.querySelector<HTMLElement>("button, a[href]")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  const menuItemClass =
    "flex w-full min-h-[36px] items-center px-4 py-2 text-left text-[14px] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]";

  return (
    <>
      <div className="sticky top-0 z-40">
        <header className="h-16 border-b border-[var(--border)] bg-[var(--card)]">
          <div className="mx-auto flex h-full w-full max-w-[1200px] items-center justify-between px-6">
            <div className="flex items-center gap-1">
              <button
                ref={drawerTriggerRef}
                type="button"
                aria-label="Open navigation"
                aria-expanded={drawerOpen}
                aria-controls="mobile-drawer"
                onClick={() => setDrawerOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] md:hidden"
              >
                <Menu size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <Link
              href="/feed"
              className="absolute left-1/2 -translate-x-1/2 select-none whitespace-nowrap rounded-[var(--radius-sm)] text-[20px] font-black uppercase tracking-[0.04em] text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
            >
              AIESEC Pulse
            </Link>

            <div className="flex items-center gap-1">
              {user?.searchEnabled && (
                <Link
                  href="/search"
                  aria-label="Search posts"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                >
                  <Search size={18} strokeWidth={2} aria-hidden />
                </Link>
              )}
              <ThemeToggle />
              {user && (
                <div ref={dropdownRef} className="relative ml-1">
                  <button
                    ref={triggerRef}
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={dropdownOpen}
                    aria-label={`Account menu for ${user.fullName}`}
                    onClick={() => setDropdownOpen((prev) => !prev)}
                    className="flex min-h-[36px] items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    <span
                      aria-hidden
                      className="flex h-7 w-7 select-none items-center justify-center rounded-full bg-[var(--primary-fill)] text-[11px] font-bold text-[var(--primary-foreground)]"
                    >
                      {initials}
                    </span>
                    <ChevronDown
                      size={13}
                      strokeWidth={2.5}
                      aria-hidden
                      className={`transition-transform duration-200 motion-reduce:transition-none ${dropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {dropdownOpen && (
                    <div
                      role="menu"
                      aria-label="Account"
                      className="absolute right-0 top-full mt-2 w-64 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] py-1"
                      style={{ boxShadow: "var(--shadow-card)" }}
                    >
                      <Link
                        href="/profile"
                        role="menuitem"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-3 transition-colors hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]"
                      >
                        <p className="text-[14px] font-medium leading-tight text-[var(--foreground)]">
                          {user.fullName}
                        </p>
                        {user.entityName && (
                          <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                            {user.entityName}
                          </p>
                        )}
                      </Link>

                      <div role="separator" className="my-1 border-t border-[var(--border)]" />

                      {user.canPublish && (
                        <Link
                          href="/posts/new"
                          role="menuitem"
                          onClick={() => setDropdownOpen(false)}
                          className={menuItemClass}
                        >
                          New post
                        </Link>
                      )}
                      {user.canPublish && (
                        <Link
                          href="/drafts"
                          role="menuitem"
                          onClick={() => setDropdownOpen(false)}
                          className={menuItemClass}
                        >
                          My drafts
                        </Link>
                      )}
                      {user.canModerate && (
                        <Link
                          href="/admin/queue"
                          role="menuitem"
                          onClick={() => setDropdownOpen(false)}
                          className={menuItemClass}
                        >
                          Moderation queue
                        </Link>
                      )}
                      {user.canAdminister && (
                        <Link
                          href="/admin/roles"
                          role="menuitem"
                          onClick={() => setDropdownOpen(false)}
                          className={menuItemClass}
                        >
                          Platform administration
                        </Link>
                      )}

                      <Link
                        href="/settings/following"
                        role="menuitem"
                        onClick={() => setDropdownOpen(false)}
                        className={menuItemClass}
                      >
                        Following
                      </Link>
                      <Link
                        href="/settings/privacy"
                        role="menuitem"
                        onClick={() => setDropdownOpen(false)}
                        className={menuItemClass}
                      >
                        Privacy &amp; your data
                      </Link>

                      <div role="separator" className="my-1 border-t border-[var(--border)]" />

                      {/* Native form POSTs so the 303 lands correctly without JS. */}
                      <form action="/api/auth/logout" method="post">
                        <button type="submit" role="menuitem" className={menuItemClass}>
                          Sign out
                        </button>
                      </form>
                      <form action="/api/auth/logout?everywhere=1" method="post">
                        <button
                          type="submit"
                          role="menuitem"
                          className={`${menuItemClass} text-[var(--muted-foreground)]`}
                        >
                          Sign out everywhere
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <nav
          aria-label="Feed"
          className="hidden h-12 items-center border-b border-[var(--border)] bg-[var(--card)] md:flex"
        >
          <div className="mx-auto flex w-full max-w-[1200px] items-center px-6">
            <div className="flex items-center gap-0.5 rounded-[8px] bg-[var(--muted)] p-1">
              <Link
                href="/feed"
                aria-current="page"
                className="relative min-h-[28px] rounded-[4px] bg-[var(--card)] px-4 py-1 text-[15px] font-bold text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                Latest
                <span
                  aria-hidden
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--primary)]"
                />
              </Link>
            </div>
          </div>
        </nav>
      </div>

      <div
        aria-hidden
        onClick={() => setDrawerOpen(false)}
        className={[
          "fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 motion-reduce:transition-none md:hidden",
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      <div
        id="mobile-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        inert={!drawerOpen}
        className={[
          "fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-[var(--card)] transition-transform duration-300 ease-in-out motion-reduce:transition-none md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
          <span className="select-none text-[16px] font-black uppercase tracking-[0.04em] text-[var(--foreground)]">
            AIESEC Pulse
          </span>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => {
              setDrawerOpen(false);
              drawerTriggerRef.current?.focus();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <nav aria-label="Sections" className="flex flex-col gap-1 p-4">
          <DrawerLink href="/feed" onNavigate={() => setDrawerOpen(false)} current>
            Latest
          </DrawerLink>
          {user?.searchEnabled && (
            <DrawerLink href="/search" onNavigate={() => setDrawerOpen(false)}>
              Search
            </DrawerLink>
          )}
          {user?.canPublish && (
            <DrawerLink href="/posts/new" onNavigate={() => setDrawerOpen(false)}>
              New post
            </DrawerLink>
          )}
          {user?.canPublish && (
            <DrawerLink href="/drafts" onNavigate={() => setDrawerOpen(false)}>
              My drafts
            </DrawerLink>
          )}
          {user?.canModerate && (
            <DrawerLink href="/admin/queue" onNavigate={() => setDrawerOpen(false)}>
              Moderation queue
            </DrawerLink>
          )}
          {user && (
            <DrawerLink href="/profile" onNavigate={() => setDrawerOpen(false)}>
              Your posts
            </DrawerLink>
          )}
          <DrawerLink href="/legal/privacy" onNavigate={() => setDrawerOpen(false)}>
            Privacy notice
          </DrawerLink>
        </nav>
      </div>
    </>
  );
}

function DrawerLink({
  href,
  children,
  onNavigate,
  current = false,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
  current?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={[
        "flex min-h-[44px] items-center rounded-[8px] px-4 py-3 text-[15px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
        current
          ? "border-l-2 border-[var(--primary)] bg-[var(--muted)] text-[var(--foreground)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
