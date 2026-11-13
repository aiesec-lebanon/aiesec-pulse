"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { useMotion } from "@/components/motion/motion-context";
import { COOKIE_NOTICE_STORAGE_KEY, COOKIE_POLICY_UPDATED } from "@/lib/cookie-policy";

const LOCAL_CHANGE_EVENT = "pulse:cookie-notice-change";

// Storage can be denied (private browsing); without this the notice would
// refuse to go away for the rest of the page's life.
let acknowledgedInMemory = false;

function readAcknowledged(): boolean {
  if (acknowledgedInMemory) return true;
  try {
    return localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) === COOKIE_POLICY_UPDATED;
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_CHANGE_EVENT, onChange);
  };
}

function acknowledge() {
  acknowledgedInMemory = true;
  try {
    localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, COOKIE_POLICY_UPDATED);
  } catch {
    // Kept for this page's life only.
  }
  window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
}

/**
 * Informational, not a consent prompt: everything Pulse stores is necessary
 * or a choice the member made (see /legal/cookies), so there is nothing to
 * refuse, and a Reject button that changed nothing would mislead.
 */
export function CookieNotice() {
  // Server snapshot is "acknowledged" so returning visitors never get a flash.
  const acknowledged = useSyncExternalStore(subscribe, readAcknowledged, () => true);
  const { motion } = useMotion();
  const [closing, setClosing] = useState(false);

  if (acknowledged) return null;

  function dismiss() {
    // A zero-length transition fires no transitionend to finish on.
    if (motion === "reduced") acknowledge();
    else setClosing(true);
  }

  return (
    // A full-bleed bar on the bottom edge, not a floating card: a card large
    // enough to read covered the sign-in CTA, the one thing that screen is for.
    <section
      aria-label="Cookie notice"
      data-closing={closing || undefined}
      onTransitionEnd={(event) => {
        if (closing && event.target === event.currentTarget && event.propertyName === "opacity")
          acknowledge();
      }}
      className="pulse-cookie-notice fixed inset-x-0 bottom-0 z-40 border-t border-[var(--hairline)] bg-[var(--card)] shadow-[var(--elev-4)]"
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-[14px] leading-[1.5] text-[color:var(--foreground)]">
          Pulse uses only essential cookies — no ads, no tracking.
        </p>
        <div className="flex shrink-0 items-center gap-6">
          <Link
            href="/legal/cookies"
            className="pulse-link inline-flex min-h-[24px] items-center rounded-[var(--radius-sm)] text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            Cookie policy
          </Link>
          <button type="button" onClick={dismiss} className="pulse-action">
            Got it
          </button>
        </div>
      </div>
    </section>
  );
}
