"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { CONSENT_MAX_AGE_SECONDS, COOKIE_NAMES, COOKIE_POLICY_VERSION } from "@/lib/cookie-policy";

/** Dispatched by the footer "Cookies" button to reopen the panel. */
export const OPEN_COOKIE_PANEL_EVENT = "pulse:open-cookie-panel";
const CHANGE_EVENT = "pulse:cookie-consent-change";
// The informational notice this replaced stored its dismissal here.
const RETIRED_NOTICE_KEY = "pulse-cookie-notice";

type Consent = {
  v: string;
  necessary: true;
  performance: boolean;
  marketing: boolean;
  ts: string;
};

// Cookies can be blocked; without this the banner would never go away.
let decidedInMemory = false;

function readConsent(): Consent | null {
  const prefix = `${COOKIE_NAMES.consent}=`;
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<Consent>;
    return parsed.v === COOKIE_POLICY_VERSION ? (parsed as Consent) : null;
  } catch {
    return null;
  }
}

function hasDecided(): boolean {
  return decidedInMemory || readConsent() !== null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function saveConsent(performance: boolean, marketing: boolean) {
  const value: Consent = {
    v: COOKIE_POLICY_VERSION,
    necessary: true,
    performance,
    marketing,
    ts: new Date().toISOString(),
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAMES.consent}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  decidedInMemory = true;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const LINK_CLASS =
  "pulse-link inline-flex min-h-[24px] items-center rounded-[var(--radius-sm)] text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";

const CATEGORIES = [
  {
    name: "Strictly necessary",
    description:
      "Needed to run Pulse, keep it secure and remember your settings (theme, reduced motion, this choice).",
    status: "Always on",
  },
  {
    name: "Performance",
    description: "Tell us how visitors use a platform so we can improve it.",
    status: "Not used on Pulse",
  },
  {
    name: "Marketing",
    description: "Decide which offers may be relevant to you and tailor ads on other sites.",
    status: "Not used on Pulse",
  },
] as const;

/**
 * The AIESEC in Lebanon cookie banner: it stays until a choice is made, and
 * Allow, Reject and Preferences carry equal weight. Pulse sets only strictly
 * necessary storage, so no choice here turns anything on or off; the banner
 * says so rather than implying otherwise.
 */
export function CookieConsent() {
  // Server snapshot is "decided" so returning visitors never get a flash.
  const decided = useSyncExternalStore(subscribe, hasDecided, () => true);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const open = () => setPanelOpen(true);
    window.addEventListener(OPEN_COOKIE_PANEL_EVENT, open);
    try {
      localStorage.removeItem(RETIRED_NOTICE_KEY);
    } catch {
      // Storage denied; nothing to clean up.
    }
    return () => window.removeEventListener(OPEN_COOKIE_PANEL_EVENT, open);
  }, []);

  useEffect(() => {
    if (panelOpen) panelHeading.current?.focus();
  }, [panelOpen]);

  if (decided && !panelOpen) return null;

  function choose(allow: boolean) {
    saveConsent(allow, allow);
    setPanelOpen(false);
  }

  const buttons = (
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      <button type="button" onClick={() => choose(true)} className="pulse-action">
        Allow all
      </button>
      <button type="button" onClick={() => choose(false)} className="pulse-action">
        Reject all
      </button>
      {!panelOpen && (
        <button type="button" onClick={() => setPanelOpen(true)} className="pulse-action">
          Learn more / choose preferences
        </button>
      )}
    </div>
  );

  return (
    // A full-bleed bar on the bottom edge, not a floating card: a card large
    // enough to read covered the sign-in CTA, the one thing that screen is for.
    <section
      aria-label={panelOpen ? "Cookie preferences" : "Cookie consent"}
      className="pulse-cookie-notice fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto border-t border-[var(--hairline)] bg-[var(--card)] shadow-[var(--elev-4)]"
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-6 py-4">
        {panelOpen ? (
          <>
            <h2
              ref={panelHeading}
              tabIndex={-1}
              className="text-[16px] font-bold text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Cookie preferences
            </h2>
            <p className="text-[14px] leading-[1.5] text-[color:var(--foreground)]">
              Some cookies are necessary to make Pulse work and cannot be turned off. For anything
              else we would need your consent to store cookies on your device and collect
              information from it. You can update your choice at any time with the{" "}
              <strong>Cookies</strong> button at the bottom of every page.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[14px]">
                <caption className="sr-only">Cookie categories on AIESEC Pulse</caption>
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th scope="col" className="py-2 pr-4 font-bold">
                      Category
                    </th>
                    <th scope="col" className="py-2 pr-4 font-bold">
                      Description
                    </th>
                    <th scope="col" className="py-2 font-bold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map((category) => (
                    <tr key={category.name} className="border-b border-[var(--hairline)]">
                      <th scope="row" className="py-2 pr-4 font-medium">
                        {category.name}
                      </th>
                      <td className="py-2 pr-4 text-[color:var(--muted-foreground)]">
                        {category.description}
                      </td>
                      <td className="py-2">{category.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[14px]">
              For every cookie and what it does, see the{" "}
              <Link href="/legal/cookies" className={LINK_CLASS}>
                Cookie policy
              </Link>
              .
            </p>
            {buttons}
          </>
        ) : (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <p className="text-[14px] leading-[1.5] text-[color:var(--foreground)]">
              <strong>Cookies consent.</strong> AIESEC in Lebanon uses only strictly necessary
              cookies and browser storage on AIESEC Pulse: to keep you signed in, protect the site
              and remember your settings. We do not use analytics or marketing cookies on this
              platform. You can change your mind at any time with the <strong>Cookies</strong>{" "}
              button.{" "}
              <Link href="/legal/cookies" className={LINK_CLASS}>
                Cookie policy
              </Link>
            </p>
            {buttons}
          </div>
        )}
      </div>
    </section>
  );
}

/** Footer control that reopens the cookie panel. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PANEL_EVENT))}
      className={className}
    >
      Cookies
    </button>
  );
}
