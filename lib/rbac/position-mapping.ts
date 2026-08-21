import type { RoleKey } from "@/lib/rbac/catalogue";

// Authority is the product of two axes and both must agree. `office.tag` says
// what level a position sits at; `role.name` says what
// the position is. Each class declares the tag it requires, and a disagreement
// denies the position rather than guessing which axis to trust — guessing is
// the only outcome that can silently over-grant.
//
// Deliberately not what `auth-template/` does. That integration derives level
// with `roleName.toUpperCase().includes('MC')` and ignores `office.tag`
// entirely, which matches `AI` inside `AIESEC` and `MC` inside `MCPartner`, and
// lets a renamed EXPA position silently change someone's reach.

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
 * Trim, case-fold, collapse internal whitespace — and nothing more. Stripping
 * punctuation or folding diacritics would widen the match surface of an
 * authorisation boundary for no title AIESEC actually issues, so it is
 * deliberately not done: `MCVP-Marketing` matching `mcvp` would be a bug, not a
 * convenience.
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
 * Denial is per-position, never per-user: someone holding one recognised and
 * one unrecognised position keeps the recognised one. A user left with no
 * grants at all cannot sign in, which is `lib/auth/identity.ts`'s call to make,
 * not this module's — it stays pure so the cross-check is testable without a
 * database.
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

  // Two positions of the same class and scope are one grant. Which of them
  // survives is not cosmetic — a global class such as `member` collapses every
  // office into one row, and the survivor's office is what the member is
  // attributed to — so the representative is the lowest office id rather than
  // whichever GIS listed first.
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
 * The office a member is attributed to. Taking `current_positions[0]` made a
 * person's home entity a function of GIS response ordering; this reads the
 * closed list's own order — most senior class first, then the lowest office id
 * — so the answer is the same on every login.
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
