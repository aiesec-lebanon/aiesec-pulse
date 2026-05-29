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

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Returns a human-readable label for an ISO week string: "2026-W21" → "May W4".
// The week number within the month is based on the Monday of that ISO week.
export function isoWeekShortLabel(week: string): string {
  const match = week.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return week;
  const year = parseInt(match[1], 10);
  const weekNum = parseInt(match[2], 10);

  // Jan 4 is always in ISO week 1; find the Monday of week 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Weekday = jan4.getUTCDay() || 7;
  const week1Monday = new Date(Date.UTC(year, 0, 4 - (jan4Weekday - 1)));

  // Advance to the Monday of the target week.
  const monday = new Date(week1Monday);
  monday.setUTCDate(monday.getUTCDate() + (weekNum - 1) * 7);

  const monthName = MONTH_SHORT[monday.getUTCMonth()];
  const weekInMonth = Math.ceil(monday.getUTCDate() / 7);
  return `${monthName} W${weekInMonth}`;
}
