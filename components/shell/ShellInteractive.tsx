"use client";

import { ChevronDown, Menu, PenLine, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { MotionToggle } from "@/components/motion/MotionToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { buildNavigation, isCurrent, type NavItem } from "@/lib/navigation";

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

const MENU_ITEM_CLASS =
  "flex w-full min-h-[36px] items-center rounded-[var(--radius-sm)] px-3 py-2 text-left text-[14px] text-[color:var(--foreground)] transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";

export function ShellInteractive({ user }: { user: ShellUser | null }) {
  const pathname = usePathname();
  const nav = buildNavigation(user);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [condensed, setCondensed] = useState(false);

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

  // Route changes close every transient surface. Without this, tapping a
  // drawer link navigates but leaves the drawer covering the page it opened.
  //
  // Adjusted during render rather than in an effect: React's documented
  // pattern for deriving state from a changed input, and it closes the drawer
  // in the same commit as the new route instead of one paint later. An effect
  // here would also trip `react-hooks/set-state-in-effect`.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setDrawerOpen(false);
    setDropdownOpen(false);
  }

  // The rail tightens once the page has moved beneath it — a small, continuous
  // signal that the header is floating over content rather than part of it.
  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setCondensed(window.scrollY > 12);
        ticking = false;
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  return (
    <>
      <header
        className={[
          "pulse-rail sticky top-0 z-40 transition-[height,box-shadow] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]",
          condensed ? "h-14 shadow-[var(--elev-2)]" : "h-[68px]",
        ].join(" ")}
      >
        <div className="mx-auto flex h-full w-full max-w-[1240px] items-center gap-2 px-4 sm:px-6">
          <button
            ref={drawerTriggerRef}
            type="button"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            onClick={() => setDrawerOpen(true)}
            className="-ml-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] lg:hidden"
          >
            <Menu size={20} strokeWidth={2} aria-hidden />
          </button>

          <Wordmark />

          {/* Desktop primary navigation. The only tab-shaped control in the
              shell — the feed's own Latest/For You switch lives on the feed,
              where the thing it switches actually is. */}
          <NavRail items={nav.primary} pathname={pathname} />

          <div className="ml-auto flex items-center gap-1">
            {nav.compose && (
              <Link
                href={nav.compose.href}
                className="group mr-1 hidden min-h-[40px] items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--primary-fill)] px-4 text-[14px] font-bold text-[color:var(--primary-foreground)] shadow-[var(--shadow-button)] transition-[transform,box-shadow] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] hover:-translate-y-[calc(1px*var(--motion-travel))] hover:shadow-[var(--elev-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:inline-flex"
              >
                <PenLine
                  size={15}
                  strokeWidth={2.5}
                  aria-hidden
                  className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:-rotate-12"
                />
                {nav.compose.label}
              </Link>
            )}

            <MotionToggle />
            <ThemeToggle />

            {user && (
              <div ref={dropdownRef} className="relative ml-0.5">
                <button
                  ref={triggerRef}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  aria-label={`Account menu for ${user.fullName}`}
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-[color:var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                >
                  <span
                    aria-hidden
                    className="flex h-8 w-8 select-none items-center justify-center rounded-full bg-[var(--primary-fill)] text-[11px] font-bold text-[color:var(--primary-foreground)] shadow-[var(--elev-1)]"
                  >
                    {initials}
                  </span>
                  <ChevronDown
                    size={13}
                    strokeWidth={2.5}
                    aria-hidden
                    className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]"
                    style={{ transform: dropdownOpen ? "rotate(180deg)" : undefined }}
                  />
                </button>

                {dropdownOpen && (
                  <div
                    role="menu"
                    aria-label="Account"
                    className="insight-enter absolute right-0 top-full mt-2 w-[264px] origin-top-right rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--card)] p-1.5 shadow-[var(--elev-4)]"
                  >
                    <Link
                      href="/profile"
                      role="menuitem"
                      className="block rounded-[var(--radius-sm)] px-3 py-2.5 transition-colors hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                    >
                      <p className="text-[14px] font-bold leading-tight text-[color:var(--foreground)]">
                        {user.fullName}
                      </p>
                      {user.entityName && (
                        <p className="mt-1 truncate text-[12px] text-[color:var(--muted-foreground)]">
                          {user.entityName}
                        </p>
                      )}
                    </Link>

                    {nav.groups.map((group) => (
                      <div key={group.id}>
                        <div
                          role="separator"
                          className="my-1.5 border-t border-[var(--hairline)]"
                        />
                        <p className="pulse-label px-3 pb-1.5 pt-1 text-[10px]">{group.label}</p>
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            role="menuitem"
                            className={MENU_ITEM_CLASS}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    ))}

                    <div role="separator" className="my-1.5 border-t border-[var(--hairline)]" />

                    {/* Native form POSTs so the 303 lands correctly without JS. */}
                    <form action="/api/auth/logout" method="post">
                      <button type="submit" role="menuitem" className={MENU_ITEM_CLASS}>
                        Sign out
                      </button>
                    </form>
                    <form action="/api/auth/logout?everywhere=1" method="post">
                      <button
                        type="submit"
                        role="menuitem"
                        className={`${MENU_ITEM_CLASS} text-[color:var(--muted-foreground)]`}
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

      <div
        aria-hidden
        onClick={() => setDrawerOpen(false)}
        className={[
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] transition-opacity duration-[calc(var(--dur-element)*var(--motion-scale))] lg:hidden",
          drawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
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
          "fixed left-0 top-0 z-50 flex h-full w-[288px] flex-col overflow-y-auto bg-[var(--card)] shadow-[var(--elev-4)] transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-[var(--hairline)] px-5">
          <span className="select-none text-[15px] font-black uppercase tracking-[0.14em] text-[color:var(--foreground)]">
            Pulse
          </span>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => {
              setDrawerOpen(false);
              drawerTriggerRef.current?.focus();
            }}
            className="-mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <nav aria-label="Sections" className="flex flex-col gap-1 p-4">
          {nav.primary.map((item) => (
            <DrawerLink key={item.href} item={item} pathname={pathname} />
          ))}

          {nav.groups.map((group) => (
            <div key={group.id} className="mt-4 flex flex-col gap-1">
              <p className="px-4 pb-1 pulse-label text-[10px]">{group.label}</p>
              {group.items.map((item) => (
                <DrawerLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          ))}

          <div className="mt-4 border-t border-[var(--hairline)] pt-4">
            <DrawerLink
              item={{ href: "/legal/privacy", label: "Privacy notice" }}
              pathname={pathname}
            />
          </div>
        </nav>
      </div>
    </>
  );
}

function Wordmark() {
  return (
    <Link
      href="/feed"
      className="group flex shrink-0 select-none items-center gap-2 rounded-[var(--radius-sm)] pr-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
    >
      {/* The mark is the product: a pulse trace, drawn once and animated on
          hover. An emoji or a bare letter would be the placeholder version. */}
      <span
        aria-hidden
        className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--primary-fill)]"
      >
        <svg viewBox="0 0 28 28" className="h-full w-full" fill="none" aria-hidden>
          <path
            d="M2 15h5.2l2.6-7.4 4.1 12.6 3-8.1 2 2.9H26"
            stroke="var(--primary-foreground)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="[stroke-dasharray:1] [stroke-dashoffset:0] transition-[stroke-dashoffset] duration-[calc(var(--dur-scene)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:[stroke-dashoffset:2]"
          />
        </svg>
      </span>
      <span className="whitespace-nowrap text-[15px] font-black uppercase leading-none tracking-[0.16em] text-[color:var(--foreground)]">
        Pulse
      </span>
    </Link>
  );
}

/**
 * The signature interaction: one indicator element that measures the active
 * item and slides between positions, rather than a border per link. Measured
 * with a layout effect so the first paint after a route change already has the
 * indicator in the right place — an indicator that visibly jumps from 0 on
 * every navigation is worse than no indicator.
 */
function NavRail({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [indicator, setIndicator] = useState({ x: 0, w: 0, o: 0 });

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) {
      setIndicator((prev) => ({ ...prev, o: 0 }));
      return;
    }
    setIndicator({ x: active.offsetLeft, w: active.offsetWidth, o: 1 });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, pathname, items.length]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // Font loading and container resizes both move the items after mount.
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Primary" className="ml-6 hidden lg:block">
      <ul ref={listRef} className="relative flex items-center gap-1">
        {items.map((item) => {
          const active = isCurrent(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-active={active}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative flex min-h-[40px] items-center rounded-[var(--radius-sm)] px-3 text-[15px] font-bold transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
                  active
                    ? "text-[color:var(--foreground)]"
                    : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        <span
          aria-hidden
          className="pulse-indicator"
          style={
            {
              "--indicator-x": `${indicator.x}px`,
              "--indicator-w": `${indicator.w}px`,
              "--indicator-o": indicator.o,
            } as React.CSSProperties
          }
        />
      </ul>
    </nav>
  );
}

function DrawerLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isCurrent(item, pathname);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex min-h-[44px] items-center rounded-[var(--radius-md)] px-4 py-3 text-[15px] font-bold transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
        active
          ? "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[color:var(--primary-text)]"
          : "text-[color:var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[color:var(--foreground)]",
      ].join(" ")}
    >
      {item.label}
    </Link>
  );
}
