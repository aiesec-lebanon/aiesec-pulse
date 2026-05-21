// Returns the ISO week string for a given date, e.g. "2026-W21".
// Fixed ISO calendar week: Monday 00:00 UTC → Sunday 23:59 UTC.
// Used to key the weekly post-count limit for MCPs.
export function currentIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; // make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // shift to Thursday of the ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
