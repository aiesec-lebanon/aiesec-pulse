// PULSE_TERM_LABEL overrides the computed value outright, so a term rollover
// can be rehearsed off-cycle.

export const TERM_START_MONTH = 7;

export function termLabelFor(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= TERM_START_MONTH ? year : year - 1;
  const two = (y: number) => String(y % 100).padStart(2, "0");
  return `${two(startYear)}.${two(startYear + 1)}`;
}

export function currentTermLabel(now: Date = new Date()): string {
  return process.env.PULSE_TERM_LABEL?.trim() || termLabelFor(now);
}

export function termEndsAt(label: string): Date | null {
  const match = label.match(/^(\d{2})\.(\d{2})$/);
  if (!match) return null;
  const endYear = 2000 + Number(match[2]);
  return new Date(Date.UTC(endYear, TERM_START_MONTH - 1, 1, 0, 0, 0));
}
