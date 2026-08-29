"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-context";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition-colors duration-200 hover:bg-[var(--card)] hover:text-[color:var(--foreground)]"
    >
      {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
    </button>
  );
}
