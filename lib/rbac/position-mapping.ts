import type { RoleKey } from "@/lib/rbac/catalogue";

// Authority requires both axes to agree: `office.tag` says the level,
// `role.name` says the position. A mismatch denies rather than guesses —
// guessing risks a silent over-grant. (Matching role-name substrings
// alone, e.g. "MC" inside "MCPartner", let a renamed position silently
// widen someone's reach.)

export type OfficeTag = "AI" | "MC" | "LC";

export type PositionInput = {
  positionId: string | null;
  roleName: string | null;
  officeId: string | null;
  officeName: string | null;
  officeTag: string | null;
};

export type PositionClass = {
  role: RoleKey;
  /** The GIS `role.name`, already normalised. Compared for equality, never for containment. */
  title: string;
  /** The `office.tag` this class must sit at. `null` accepts any level. */
  requiredTag: OfficeTag | null;
  /** Global authority holds everywhere; office authority holds over its own subtree. */
  authority: "GLOBAL" | "OFFICE";
};

export const POSITION_CLASSES: readonly PositionClass[] = [
  { role: "pai", title: "pai", requiredTag: "AI", authority: "GLOBAL" },
  { role: "ai_vp", title: "aivp", requiredTag: "AI", authority: "GLOBAL" },
  { role: "ai_manager", title: "ai manager", requiredTag: "AI", authority: "GLOBAL" },
  { role: "mc_president", title: "mcp", requiredTag: "MC", authority: "OFFICE" },
  { role: "mc_vp", title: "mcvp", requiredTag: "MC", authority: "OFFICE" },
  { role: "lc_president", title: "lcp", requiredTag: "LC", authority: "OFFICE" },
  { role: "lc_vp", title: "lcvp", requiredTag: "LC", authority: "OFFICE" },
  { role: "member", title: "member", requiredTag: null, authority: "OFFICE" },
];

export type DerivedGrant = {
  role: RoleKey;
  positionId: string | null;
  /** The office the position sits at. Always present — it is what a grant is scoped from. */
  officeId: string;
  /** The office the grant covers, or `null` for a class whose authority is global. */
  scopeOfficeId: string | null;
  matchedTitle: string;
};

export type DenialReason =
  | "no_office"
  | "no_title"
  | "unknown_office_tag"
  | "unrecognised_title"
  | "tag_mismatch";

export type PositionDenial = {
  positionId: string | null;
  roleName: string | null;
  officeId: string | null;
  officeName: string | null;
  officeTag: string | null;
  reason: DenialReason;
  /** The tag the matched class required, when the two axes disagreed. */
  expectedTag?: OfficeTag;
};

export type MappingOutcome = {
  grants: DerivedGrant[];
  denied: PositionDenial[];
};

/**
 * Trim, case-fold, collapse whitespace — nothing more. Stripping
 * punctuation or diacritics would widen an authorisation match for no
 * real title: `MCVP-Marketing` matching `mcvp` would be a bug, not help.
 */
export function normaliseTitle(raw: string): string {
  return raw.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function normaliseTag(raw: string): OfficeTag | null {
  const tag = raw.normalize("NFKC").toUpperCase().replace(/\s+/g, "").trim();
  return tag === "AI" || tag === "MC" || tag === "LC" ? tag : null;
}

export function classForTitle(normalisedTitle: string): PositionClass | null {
  return POSITION_CLASSES.find((c) => c.title === normalisedTitle) ?? null;
}

function denial(
  position: PositionInput,
  reason: DenialReason,
  expectedTag?: OfficeTag
): PositionDenial {
  return {
    positionId: position.positionId,
    roleName: position.roleName,
    officeId: position.officeId,
    officeName: position.officeName,
    officeTag: position.officeTag,
    reason,
    ...(expectedTag ? { expectedTag } : {}),
  };
}

/**
 * Denial is per-position, never per-user — one unrecognised position
 * doesn't cost a recognised one. Whether zero grants blocks sign-in is
 * `lib/auth/identity.ts`'s call; staying pure keeps this testable DB-free.
 */
export function derivePositionGrants(positions: readonly PositionInput[]): MappingOutcome {
  const grants: DerivedGrant[] = [];
  const denied: PositionDenial[] = [];

  for (const position of positions) {
    if (!position.officeId) {
      denied.push(denial(position, "no_office"));
      continue;
    }
    if (!position.roleName?.trim()) {
      denied.push(denial(position, "no_title"));
      continue;
    }

    const matched = classForTitle(normaliseTitle(position.roleName));
    if (!matched) {
      denied.push(denial(position, "unrecognised_title"));
      continue;
    }

    if (matched.requiredTag !== null) {
      const tag = position.officeTag ? normaliseTag(position.officeTag) : null;
      if (!tag) {
        denied.push(denial(position, "unknown_office_tag", matched.requiredTag));
        continue;
      }
      if (tag !== matched.requiredTag) {
        denied.push(denial(position, "tag_mismatch", matched.requiredTag));
        continue;
      }
    }

    grants.push({
      role: matched.role,
      positionId: position.positionId,
      officeId: position.officeId,
      scopeOfficeId: matched.authority === "GLOBAL" ? null : position.officeId,
      matchedTitle: matched.title,
    });
  }

  // Same class+scope collapses to one grant. Which survives isn't cosmetic
  // — for a global class like `member` it decides the office the person is
  // attributed to — so it's the lowest office id, not GIS's listing order.
  const byKey = new Map<string, DerivedGrant>();
  for (const grant of grants) {
    const key = `${grant.role}:${grant.scopeOfficeId ?? "GLOBAL"}`;
    const existing = byKey.get(key);
    if (!existing || grant.officeId.localeCompare(existing.officeId) < 0) {
      byKey.set(key, grant);
    }
  }

  return { grants: [...byKey.values()], denied };
}

const CLASS_PRECEDENCE = new Map(POSITION_CLASSES.map((c, index) => [c.role, index]));

/**
 * The office a member is attributed to. `current_positions[0]` made this
 * depend on GIS response ordering; this instead ranks by class seniority
 * then lowest office id, so the answer is stable across logins.
 */
export function choosePrimaryOfficeId(grants: readonly DerivedGrant[]): string | null {
  if (grants.length === 0) return null;

  const ranked = [...grants].sort((a, b) => {
    const byClass =
      (CLASS_PRECEDENCE.get(a.role) ?? Number.MAX_SAFE_INTEGER) -
      (CLASS_PRECEDENCE.get(b.role) ?? Number.MAX_SAFE_INTEGER);
    if (byClass !== 0) return byClass;
    return a.officeId.localeCompare(b.officeId);
  });

  return ranked[0].officeId;
}
