// Returns the ISO week string for a given date, e.g. "2026-W21".
// Fixed ISO calendar week: Monday 00:00 UTC → Sunday 23:59 UTC.
// Used to key the weekly post-count limit for MCPs.
export function currentIsoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // shift to Thursday of the ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Returns the last n ISO week strings, oldest → newest, ending with the current week.
export function lastNIsoWeeks(n: number, from: Date = new Date()): string[] {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1)); // rewind to Monday of current ISO week
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d);
    t.setUTCDate(t.getUTCDate() - i * 7);
    result.push(currentIsoWeek(t));
  }
  return result;
}

// Extracts the short label from an ISO week string: "2026-W21" → "W21".
export function isoWeekShortLabel(week: string): string {
  const parts = week.split("-");
  return parts[1] ?? week;
}
