import type { EntityKind } from "@/app/generated/prisma/enums";

/**
 * GIS stores the bare place ("Lebanon"); MC/LC brand names need the
 * "AIESEC in {place}" prefix. GLOBAL/REGION are already full names
 * ("AIESEC International", "Middle East and Africa"). A name already
 * carrying the wordmark passes through untouched.
 */

const ALREADY_BRANDED = /^aiesec\b/i;

export function entityDisplayName(
  name: string | null | undefined,
  kind?: EntityKind | null
): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  if (ALREADY_BRANDED.test(trimmed)) return trimmed;
  if (kind === "GLOBAL" || kind === "REGION") return trimmed;

  return `AIESEC in ${trimmed}`;
}

/** Splits the lockup into wordmark + rest; `mark` is null when there's no wordmark (e.g. a region name). */
export function splitBrandLockup(displayName: string): { mark: string | null; rest: string } {
  const match = /^(AIESEC)(\b[\s\S]*)$/i.exec(displayName);
  if (!match) return { mark: null, rest: displayName };
  return { mark: match[1], rest: match[2] };
}

/**
 * The place half of the lockup, for `DisplayTitle`'s `accentWord` — the
 * wordmark is constant network-wide, so accenting it would be decoration,
 * not a signal. Null when there's no place to accent (e.g. a region name).
 */
export function brandPlaceAccent(displayName: string): string | null {
  const { mark, rest } = splitBrandLockup(displayName);
  if (!mark) return null;
  const place = rest.trim();
  return place.length > 0 ? place : null;
}
