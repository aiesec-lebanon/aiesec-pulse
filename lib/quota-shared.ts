// Split out of lib/quota.ts the same way lib/search-shared.ts was split out of
// lib/search.ts: that module is "server-only" and pulls in @/lib/db, so the
// quota administration table ("use client") cannot import a single named
// export from it without dragging the pg driver into the browser bundle.

import type { QuotaPeriod } from "@/app/generated/prisma/enums";

export const PERIOD_NAMES: Record<QuotaPeriod, string> = {
  ISO_WEEK: "Per week",
  CALENDAR_MONTH: "Per month",
};

/**
 * A ceiling on an administered budget. Not a product rule — a typo guard, so a
 * slipped keystroke cannot quietly turn a weekly allowance into an unlimited
 * one that nobody notices until the feed is unreadable.
 */
export const MAX_BUDGET = 500;

/**
 * Rejects anything a budget cannot be: fractional, negative, absurd — or
 * absent. Number("") and Number(null) are both 0, so an empty field would
 * otherwise save as a budget of nothing rather than as a mistake.
 */
export function parseBudget(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_BUDGET) return null;
  return parsed;
}
