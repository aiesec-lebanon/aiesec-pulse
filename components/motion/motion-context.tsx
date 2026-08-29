"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

/**
 * "full" is default until the OS prefers-reduced-motion signal or an
 * explicit choice overrides it — no standalone Motion button exists, so
 * the OS signal alone gates parallax-by-default. "reduced" zeroes
 * `--motion-travel`/`--motion-scale` (globals.css); colour, focus, and
 * state transitions survive since those carry meaning, not atmosphere.
 */

export type MotionPreference = "full" | "reduced";

type MotionCtx = {
  motion: MotionPreference;
  setMotion: (_next: MotionPreference) => void;
  /** Whether the current value came from the OS rather than an explicit choice. */
  fromSystem: boolean;
};

const Ctx = createContext<MotionCtx>({ motion: "full", setMotion: () => {}, fromSystem: false });

export const useMotion = () => useContext(Ctx);

export const MOTION_STORAGE_KEY = "pulse-motion";
export const MOTION_ATTRIBUTE = "data-motion";
const LOCAL_CHANGE_EVENT = "pulse:motion-change";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function systemPrefersReduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_QUERY).matches;
}

function readExplicit(): MotionPreference | null {
  try {
    const stored = localStorage.getItem(MOTION_STORAGE_KEY);
    return stored === "reduced" || stored === "full" ? stored : null;
  } catch {
    // Private browsing can deny storage entirely.
    return null;
  }
}

/** The same resolution order BootScript runs before first paint. */
function readStored(): MotionPreference {
  return readExplicit() ?? (systemPrefersReduced() ? "reduced" : "full");
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_CHANGE_EVENT, onChange);
  // The OS setting can change mid-session (a "reduce motion" shortcut, a
  // scheduled accessibility profile) — must re-check or motion keeps going.
  const media = window.matchMedia(REDUCED_QUERY);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_CHANGE_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  // Server and first client render report "full" to match the markup's
  // attribute; BootScript already corrected <html> pre-paint, and this
  // store catches up on the first post-hydration commit.
  const motion = useSyncExternalStore<MotionPreference>(subscribe, readStored, () => "full");
  const explicit = useSyncExternalStore<MotionPreference | null>(
    subscribe,
    readExplicit,
    () => null
  );

  useEffect(() => {
    document.documentElement.setAttribute(MOTION_ATTRIBUTE, motion);
  }, [motion]);

  function setMotion(next: MotionPreference) {
    try {
      // Written, not removed, even for "full" — clearing the key would
      // hand the decision back to the OS setting the reader just overruled.
      localStorage.setItem(MOTION_STORAGE_KEY, next);
    } catch {
      // Storage denied: the choice applies for this session but is not kept.
    }
    window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  }

  return (
    <Ctx.Provider value={{ motion, setMotion, fromSystem: explicit === null }}>
      {children}
    </Ctx.Provider>
  );
}

/**
 * Read the live preference outside React's render path — for rAF loops,
 * IntersectionObservers and canvas draws that need to bail out synchronously
 * rather than re-render. Safe to call during SSR.
 */
export function motionEnabled(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute(MOTION_ATTRIBUTE) !== "reduced";
}
