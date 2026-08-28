// Split from lib/quota.ts (server-only, pulls in @/lib/db) so the "use
// client" admin table can import these without bundling the pg driver.

import type { QuotaPeriod } from "@/app/generated/prisma/enums";

export const PERIOD_NAMES: Record<QuotaPeriod, string> = {
  ISO_WEEK: "Per week",
  CALENDAR_MONTH: "Per month",
};

/**
 * Typo guard, not a product rule — stops a slipped keystroke turning a
 * weekly allowance into an effectively unlimited one.
 */
export const MAX_BUDGET = 500;

/**
 * Rejects fractional, negative, absurd, or absent values. Number("") and
 * Number(null) are both 0, so an empty field would silently save as zero.
 */
export function parseBudget(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_BUDGET) return null;
  return parsed;
}
