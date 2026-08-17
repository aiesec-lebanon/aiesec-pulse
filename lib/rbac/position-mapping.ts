import type { RoleKey } from "@/lib/rbac/catalogue";

// role.name is free text, so matching is on a normalised prefix from a
// controlled vocabulary. The office is carried through so grants stay scoped.

export type PositionInput = {
  positionId: string | null;
  roleName: string | null;
  officeId: string | null;
  officeName: string | null;
  officeTag: string | null;
  officeDepth?: number;
};

export type DerivedGrant = {
  role: RoleKey;
  officeId: string | null;
  positionId: string | null;
  matchedTitle: string;
};

export function normaliseTitle(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Most specific first, matched on whole leading words so "mcp" matches "mcp"
// and "mcp elect" but not "mcpartner". `rank` picks the primary position.
const PUBLISHER_TITLES: ReadonlyArray<{ prefix: string; rank: number }> = [
  { prefix: "mcp", rank: 100 },
  { prefix: "mcvp", rank: 90 },
  { prefix: "member committee president", rank: 100 },
  { prefix: "member committee vice president", rank: 90 },
  { prefix: "lcp", rank: 70 },
  { prefix: "lcvp", rank: 60 },
  { prefix: "local committee president", rank: 70 },
  { prefix: "local committee vice president", rank: 60 },
  { prefix: "national director", rank: 80 },
  { prefix: "national manager", rank: 50 },
  { prefix: "regional director", rank: 85 },
  { prefix: "regional manager", rank: 55 },
];

const GLOBAL_PUBLISHER_TITLES: ReadonlyArray<{ prefix: string; rank: number }> = [
  { prefix: "president", rank: 110 },
  { prefix: "vice president", rank: 105 },
  { prefix: "global vice president", rank: 105 },
  { prefix: "ai vp", rank: 105 },
  { prefix: "director", rank: 95 },
  { prefix: "manager", rank: 65 },
];

function matchPrefix(
  title: string,
  table: ReadonlyArray<{ prefix: string; rank: number }>
): { prefix: string; rank: number } | null {
  for (const entry of table) {
    if (title === entry.prefix || title.startsWith(`${entry.prefix} `)) return entry;
  }
  return null;
}

export const GLOBAL_OFFICE_ID = "1";

export type MappingOutcome = {
  grants: DerivedGrant[];
  unmatched: Array<{ positionId: string | null; roleName: string; officeId: string | null }>;
};

export function derivePublishingGrants(positions: readonly PositionInput[]): MappingOutcome {
  const grants: DerivedGrant[] = [];
  const unmatched: MappingOutcome["unmatched"] = [];

  for (const position of positions) {
    if (!position.roleName) continue;
    const title = normaliseTitle(position.roleName);
    if (!title) continue;

    const isGlobalOffice = position.officeId === GLOBAL_OFFICE_ID || position.officeDepth === 1;

    if (isGlobalOffice) {
      const hit = matchPrefix(title, GLOBAL_PUBLISHER_TITLES);
      if (hit) {
        grants.push({
          role: "global_publisher",
          officeId: null,
          positionId: position.positionId,
          matchedTitle: hit.prefix,
        });
        continue;
      }
    }

    const hit = matchPrefix(title, PUBLISHER_TITLES);
    if (hit && position.officeId) {
      grants.push({
        role: "entity_publisher",
        officeId: position.officeId,
        positionId: position.positionId,
        matchedTitle: hit.prefix,
      });
      continue;
    }

    unmatched.push({
      positionId: position.positionId,
      roleName: position.roleName,
      officeId: position.officeId,
    });
  }

  const seen = new Set<string>();
  const deduped = grants.filter((g) => {
    const key = `${g.role}:${g.officeId ?? "GLOBAL"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { grants: deduped, unmatched };
}

// Ranked deterministically rather than taking whichever GIS returned first.
export function choosePrimaryPosition(positions: readonly PositionInput[]): PositionInput | null {
  const candidates = positions.filter((p) => p.officeId);
  if (candidates.length === 0) return null;

  const scored = candidates.map((position) => {
    const title = position.roleName ? normaliseTitle(position.roleName) : "";
    const hit = matchPrefix(title, GLOBAL_PUBLISHER_TITLES) ?? matchPrefix(title, PUBLISHER_TITLES);
    return { position, rank: hit?.rank ?? 0, depth: position.officeDepth ?? 0 };
  });

  scored.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    if (b.depth !== a.depth) return b.depth - a.depth;
    return (a.position.officeId ?? "").localeCompare(b.position.officeId ?? "");
  });

  return scored[0].position;
}
