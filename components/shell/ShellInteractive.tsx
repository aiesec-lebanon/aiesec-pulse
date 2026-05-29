"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, Menu, X, ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export type ShellUser = {
  full_name: string;
  profile_photo?: string;
  isMcp?: boolean;
  current_positions?: Array<{
    office?: { id?: string; name: string; tag?: string };
    role?: { id?: string; name: string };
  }>;
};

const TABS = [
  { label: "Home", active: false },
  { label: "Latest", active: true },
  { label: "Top", active: false },
  { label: "By Region", active: false },
  { label: "By Function", active: false },
] as const;

export function ShellInteractive({ user }: { user: ShellUser | null }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const committeeName = user?.current_positions?.[0]?.office?.name;
  const initials = user?.full_name
    ? user.full_name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [dropdownOpen]);

  // Close dropdown on Escape; close drawer on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (dropdownOpen) {
          setDropdownOpen(false);
          triggerRef.current?.focus();
        } else if (drawerOpen) {
          setDrawerOpen(false);
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dropdownOpen, drawerOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <>
      {/* ── Sticky wrapper: top bar + category nav ─────────────────────── */}
      <div className="sticky top-0 z-40">
        {/* Top bar — 64px */}
        <header className="h-16 border-b border-[var(--border)] bg-[var(--card)]">
          <div className="mx-auto flex h-full w-full max-w-[1200px] items-center justify-between px-6">
            {/* Left cluster */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Search"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <Search size={18} strokeWidth={2} />
              </button>
              {/* Hamburger — mobile only */}
              <button
                type="button"
                aria-label="Open navigation"
                aria-expanded={drawerOpen}
                aria-controls="mobile-drawer"
                onClick={() => setDrawerOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] md:hidden"
              >
                <Menu size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Center — wordmark, absolutely centered so it doesn't shift with content */}
            <Link
              href="/feed"
              className="absolute left-1/2 -translate-x-1/2 select-none whitespace-nowrap text-[20px] font-black uppercase tracking-[0.04em] text-[var(--foreground)]"
            >
              AIESEC Pulse
            </Link>

            {/* Right cluster */}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              {user && (
                <div ref={dropdownRef} className="relative ml-1">
                  <button
                    ref={triggerRef}
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={dropdownOpen}
                    aria-label="User menu"
                    onClick={() => setDropdownOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    <span className="flex h-7 w-7 select-none items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-bold text-[var(--primary-foreground)]">
                      {initials}
                    </span>
                    <ChevronDown
                      size={13}
                      strokeWidth={2.5}
                      className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Dropdown menu */}
                  {dropdownOpen && (
                    <div
                      role="menu"
                      aria-label="User options"
                      className="absolute right-0 top-full mt-2 w-56 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] py-1"
                      style={{ boxShadow: "var(--shadow-card)" }}
                    >
                      {/* Identity block — links to profile */}
                      <Link
                        href="/profile"
                        role="menuitem"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-3 transition-colors hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-none"
                      >
                        <p className="text-[14px] font-medium leading-tight text-[var(--foreground)]">
                          {user.full_name}
                        </p>
                        {committeeName && (
                          <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                            {committeeName}
                          </p>
                        )}
                      </Link>

                      <div
                        role="separator"
                        className="my-1 border-t border-[var(--border)]"
                      />

                      {user.isMcp && (
                        <Link
                          href="/posts/new"
                          role="menuitem"
                          onClick={() => setDropdownOpen(false)}
                          className="flex w-full items-center px-4 py-2 text-[14px] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-none"
                        >
                          New post
                        </Link>
                      )}

                      {/* Native form POST so the 302 redirect lands correctly without JS */}
                      <form action="/api/auth/logout" method="post">
                        <button
                          type="submit"
                          role="menuitem"
                          className="flex w-full items-center px-4 py-2 text-[14px] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-none"
                        >
                          Logout
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Category nav — 48px, desktop only */}
        <nav
          aria-label="Feed categories"
          className="hidden h-12 items-center border-b border-[var(--border)] bg-[var(--card)] md:flex"
        >
          <div className="mx-auto flex w-full max-w-[1200px] items-center px-6">
            <div className="flex items-center gap-0.5 rounded-[8px] bg-[var(--muted)] p-1">
              {TABS.map(({ label, active }) => (
                <Link
                  key={label}
                  href="/feed"
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative rounded-[4px] px-4 py-1 text-[15px] font-bold transition-colors",
                    active
                      ? "bg-[var(--card)] text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  ].join(" ")}
                >
                  {label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--primary)]"
                    />
                  )}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setDrawerOpen(false)}
        className={[
          "fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 md:hidden",
          drawerOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Panel */}
      <div
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={[
          "fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-[var(--card)] transition-transform duration-300 ease-in-out md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Drawer header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
          <span className="select-none text-[16px] font-black uppercase tracking-[0.04em] text-[var(--foreground)]">
            AIESEC Pulse
          </span>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Drawer category links */}
        <nav aria-label="Categories" className="flex flex-col gap-1 p-4">
          {TABS.map(({ label, active }) => (
            <Link
              key={label}
              href="/feed"
              onClick={() => setDrawerOpen(false)}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center rounded-[8px] px-4 py-3 text-[15px] font-bold transition-colors",
                active
                  ? "border-l-2 border-[var(--primary)] bg-[var(--muted)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
