"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

type ThemeCtx = {
  theme: Theme;
  resolvedTheme: Resolved;
  setTheme: (t: Theme) => void;
};

const Ctx = createContext<ThemeCtx>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

export const useTheme = () => useContext(Ctx);

function getSystem(): Resolved {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStored(): Theme {
  try {
    return (localStorage.getItem("theme") as Theme) ?? "system";
  } catch {
    return "system";
  }
}

function applyClass(resolved: Resolved) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolved] = useState<Resolved>("light");

  useEffect(() => {
    const stored = getStored();
    const resolved = stored === "system" ? getSystem() : stored;
    setThemeState(stored);
    setResolved(resolved);
    applyClass(resolved);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStored() === "system") {
        const r = getSystem();
        setResolved(r);
        applyClass(r);
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  function setTheme(t: Theme) {
    try {
      t === "system"
        ? localStorage.removeItem("theme")
        : localStorage.setItem("theme", t);
    } catch {}
    const resolved = t === "system" ? getSystem() : t;
    setThemeState(t);
    setResolved(resolved);
    applyClass(resolved);
  }

  return (
    <Ctx.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </Ctx.Provider>
  );
}
