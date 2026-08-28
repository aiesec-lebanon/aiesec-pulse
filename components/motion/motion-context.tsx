"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

/**
 * Motion preference.
 *
 * Motion is a first-class part of this interface, and "full" is the default —
 * but only for a reader who hasn't already told their OS otherwise.
 * `prefers-reduced-motion: reduce` is honoured as the *starting* value, and an
 * explicit choice inside Pulse overrides it either way. This is a deliberate
 * change from the previous position ("an OS preference set years ago for a
 * different device shouldn't silently decide what this product looks like"):
 * the header no longer carries a standalone Motion button, so the OS signal
 * is the only thing standing between a motion-sensitive reader and a page
 * full of parallax. The explicit control moved into the account menu and the
 * sign-in header — still one click from anywhere.
 *
 * Because the OS is now a real input, opting *in* to full motion has to be
 * stored explicitly — removing the key would hand the decision straight back
 * to the OS the reader just overruled.
 *
 * "reduced" is not "none": it zeroes `--motion-travel` and `--motion-scale`
 * (see globals.css), stopping scenes, parallax, 3-D tilt, the rotators and
 * the ambient canvas, while colour, focus and state transitions survive —
 * those carry meaning, not atmosphere.
 *
 * Mirrors theme-context deliberately: same storage strategy, same
 * useSyncExternalStore shape, same cross-tab event. Two preferences that behave
 * differently for no reason is a maintenance trap for a rotating volunteer team.
 */

export type MotionPreference = "full" | "reduced";

type MotionCtx = {
  motion: MotionPreference;
  setMotion: (next: MotionPreference) => void;
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
  // scheduled accessibility profile) — without this the page would keep
  // animating until the next navigation.
  const media = window.matchMedia(REDUCED_QUERY);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_CHANGE_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  // Server and first client render both report "full", matching the attribute
  // the markup ships with — BootScript has already corrected <html> before
  // paint, and this store catches up on the first post-hydration commit, so
  // nothing animates out of the wrong state.
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
      // Written, not removed, even for "full": the OS is a real input now, and
      // clearing the key would return the decision to the setting the reader
      // has just overruled.
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
