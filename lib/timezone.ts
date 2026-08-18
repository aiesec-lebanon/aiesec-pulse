// No date/timezone library is a project dependency (architecture.md §3.3 keeps
// the stack minimal), so converting a `datetime-local` picker's wall-clock
// value into the correct UTC instant for an arbitrary IANA zone is done with
// plain Intl — the standard "format, diff, correct" technique.

function offsetParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Midnight can format as hour "24" under hour12: false in some engines.
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Interprets a `datetime-local` input's value (bare wall-clock digits, no
 * zone) as a moment in `timeZone` and returns the equivalent UTC instant.
 * Needed because the picker reports whatever the browser's own clock reads,
 * but architecture.md §8.3 requires scheduling to honour the author's stored
 * `User.timezone`, not the browser's — "Monday 9am Beirut" must mean that
 * regardless of where the author's browser happens to be.
 */
export function zonedWallTimeToUtc(localDateTime: string, timeZone: string): Date {
  const naiveUtc = new Date(`${localDateTime}:00.000Z`);
  if (Number.isNaN(naiveUtc.getTime())) return naiveUtc;

  const p = offsetParts(naiveUtc, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const drift = asIfUtc - naiveUtc.getTime();

  return new Date(naiveUtc.getTime() - drift);
}

/** The inverse: formats a UTC instant as the `datetime-local`-shaped wall-clock string for `timeZone`. */
export function formatAsWallTime(instant: Date, timeZone: string): string {
  const p = offsetParts(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** A short human label like "GMT+3" for the hint text next to the picker. */
export function timeZoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}
