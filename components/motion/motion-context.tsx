"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

/**
 * Motion preference.
 *
 * Pulse treats motion as an explicit member choice rather than an inferred OS
 * setting: the header carries a Motion control beside the theme control, and
 * "full" is the default for everyone. The reasoning is the same one behind the
 * theme toggle — an OS-level preference set years ago for a different device
 * shouldn't silently decide what this product looks like — and the cost of that
 * position is that the opt-out has to be *findable*, which is why the control
 * sits in the header rather than in a settings page.
 *
 * "reduced" is not "none". It zeroes `--motion-travel` and `--motion-scale`
 * (see globals.css), which stops scenes, parallax, 3-D tilt and the ambient
 * canvas, while colour, focus and state transitions survive — those carry
 * meaning, not atmosphere.
 *
 * Mirrors theme-context deliberately: same storage strategy, same
 * useSyncExternalStore shape, same cross-tab event. Two preferences that behave
 * differently for no reason is a maintenance trap for a rotating volunteer team.
 */

export type MotionPreference = "full" | "reduced";

type MotionCtx = {
  motion: MotionPreference;
  setMotion: (next: MotionPreference) => void;
};

const Ctx = createContext<MotionCtx>({ motion: "full", setMotion: () => {} });

export const useMotion = () => useContext(Ctx);

export const MOTION_STORAGE_KEY = "pulse-motion";
export const MOTION_ATTRIBUTE = "data-motion";
const LOCAL_CHANGE_EVENT = "pulse:motion-change";

function readStored(): MotionPreference {
  try {
    return localStorage.getItem(MOTION_STORAGE_KEY) === "reduced" ? "reduced" : "full";
  } catch {
    // Private browsing can deny storage entirely.
    return "full";
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

export function MotionProvider({ children }: { children: React.ReactNode }) {
  // Server and first client render both report "full", matching what
  // BootScript has already written to <html> — so hydration never has to
  // correct the attribute, and nothing animates out of the wrong state.
  const motion = useSyncExternalStore<MotionPreference>(subscribe, readStored, () => "full");

  useEffect(() => {
    document.documentElement.setAttribute(MOTION_ATTRIBUTE, motion);
  }, [motion]);

  function setMotion(next: MotionPreference) {
    try {
      if (next === "full") localStorage.removeItem(MOTION_STORAGE_KEY);
      else localStorage.setItem(MOTION_STORAGE_KEY, next);
    } catch {
      // Storage denied: the choice applies for this session but is not kept.
    }
    window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  }

  return <Ctx.Provider value={{ motion, setMotion }}>{children}</Ctx.Provider>;
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
