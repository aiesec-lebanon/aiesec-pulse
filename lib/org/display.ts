import type { EntityKind } from "@/app/generated/prisma/enums";

/**
 * How an office is named to a reader.
 *
 * GIS stores an office's *place* — "Lebanon", "São Paulo", "Cairo" — because
 * that is the only part that varies. The brand's name for that office is the
 * full lockup, "AIESEC in Lebanon", and shipping the bare place name is a
 * brand violation, not a shorter label: "Lebanon published this" says a
 * country published it.
 *
 * The prefix is not universal, which is why this is keyed on `kind` rather
 * than applied to every string:
 *
 *   - `MC` / `LC` — a member or local committee *is* "AIESEC in {place}".
 *   - `GLOBAL`    — the international office is "AIESEC International", and
 *                   any global team ("Global Teams") is already named in full.
 *   - `REGION`    — a region is a grouping ("Middle East and Africa"), not an
 *                   office, and "AIESEC in Middle East and Africa" is wrong.
 *
 * A name that already begins with the wordmark is returned untouched, so a
 * GIS record that happens to store the full lockup is never doubled up into
 * "AIESEC in AIESEC in Brazil". `kind` is optional because a few call sites
 * only have a name to work with; without it the function assumes a committee,
 * which is what the overwhelming majority of named offices are.
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

/**
 * The two halves of the lockup, for the one surface per screen that colours
 * them separately. Returns `mark: null` when the name carries no wordmark — a
 * region name, or a name that never took the prefix — so a caller can render
 * one span instead of two rather than branching on a regex of its own.
 */
export function splitBrandLockup(displayName: string): { mark: string | null; rest: string } {
  const match = /^(AIESEC)(\b[\s\S]*)$/i.exec(displayName);
  if (!match) return { mark: null, rest: displayName };
  return { mark: match[1], rest: match[2] };
}

/**
 * The half of an office's name that takes the editorial accent, for passing
 * straight to `DisplayTitle`'s `accentWord`: **the place, not the wordmark**.
 * "AIESEC in Brazil" accents "in Brazil".
 *
 * The wordmark is constant across the network and the place is the variable.
 * Accenting the constant would put the same mark on every page — decoration,
 * not a signal — which is the direction the first implementation had it.
 *
 * Null when there's nothing to accent: "AIESEC International" is all
 * wordmark and no place, "Middle East and Africa" never took a prefix —
 * which is what makes this safe to call unconditionally.
 */
export function brandPlaceAccent(displayName: string): string | null {
  const { mark, rest } = splitBrandLockup(displayName);
  if (!mark) return null;
  const place = rest.trim();
  return place.length > 0 ? place : null;
}
