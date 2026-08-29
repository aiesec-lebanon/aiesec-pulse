"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

type ThemeCtx = {
  theme: Theme;
  resolvedTheme: Resolved;
  setTheme: (_t: Theme) => void;
};

const Ctx = createContext<ThemeCtx>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

export const useTheme = () => useContext(Ctx);

const MEDIA_QUERY = "(prefers-color-scheme: dark)";
const STORAGE_KEY = "theme";
const LOCAL_CHANGE_EVENT = "pulse:theme-change";

function readStored(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    // Private browsing can deny storage entirely.
    return "system";
  }
}

function readSystem(): Resolved {
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function applyClass(resolved: Resolved) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

// useSyncExternalStore, not useState — both sources of truth live outside
// React and mirroring via an effect double-renders. BootScript sets the
// first paint pre-hydration to avoid a flash.
function subscribeToStored(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_CHANGE_EVENT, onChange);
  };
}

function subscribeToSystem(onChange: () => void): () => void {
  const mql = window.matchMedia(MEDIA_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(subscribeToStored, readStored, () => "system");
  const systemTheme = useSyncExternalStore<Resolved>(subscribeToSystem, readSystem, () => "light");

  const resolvedTheme: Resolved = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    applyClass(resolvedTheme);
  }, [resolvedTheme]);

  function setTheme(next: Theme) {
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage denied: the choice applies for this session but is not kept.
    }
    window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  }

  return <Ctx.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</Ctx.Provider>;
}
