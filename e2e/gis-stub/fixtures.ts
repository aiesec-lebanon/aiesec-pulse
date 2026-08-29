// GIS `currentPerson` payloads, one per position class plus refusal cases —
// in GIS's actual wire shape (snake_case, string/number ids), not a Pulse
// convenience object. gis-contract.test.ts parses these through the real
// Zod schema, so a GIS shape drift fails CI. Not imported by app code.

/** The GIS office shape, as the `currentPerson` query selects it. */
export type StubOffice = {
  id: string;
  name: string;
  tag: string | null;
  country: string | null;
  parent: { id: string } | null;
};

/**
 * Real AI → region → MC → LC depth; `ai` matches the seed root (gisOfficeId
 * "1") exactly or resolveOfficeEntity treats it as drift. Needs: two LCs
 * under one MC (sister-LC reach), two MCs under one region (defines
 * "outside scope"), and a real region tier (or kindForDepth mis-stores the
 * MC as REGION and breaks promotion's nearest-MC lookup).
 */
export const OFFICES = {
  ai: {
    id: "1",
    name: "AIESEC International",
    tag: "AI",
    country: null,
    parent: null,
  },
  region: {
    id: "900000",
    name: "Testing Region",
    tag: "REGION",
    country: null,
    parent: { id: "1" },
  },
  mc: {
    id: "900001",
    name: "AIESEC in Testonia",
    tag: "MC",
    country: "TT",
    parent: { id: "900000" },
  },
  lc: {
    id: "900002",
    name: "AIESEC in Testville",
    tag: "LC",
    country: "TT",
    parent: { id: "900001" },
  },
  otherLc: {
    id: "900003",
    name: "AIESEC in Otherton",
    tag: "LC",
    country: "TT",
    parent: { id: "900001" },
  },
  farMc: {
    id: "900004",
    name: "AIESEC in Farland",
    tag: "MC",
    country: "FF",
    parent: { id: "900000" },
  },
  farLc: {
    id: "900005",
    name: "AIESEC in Fartown",
    tag: "LC",
    country: "FF",
    parent: { id: "900004" },
  },
} as const satisfies Record<string, StubOffice>;

/**
 * Interior offices, root-first, with the path/kind Pulse's derivation gives
 * them. Without seeding these upfront, resolveOfficeEntity would park a
 * missing-parent office under root at first login — making tree shape
 * depend on spec run order. Leaves are left out; they arrive via login.
 */
export const INTERIOR_OFFICES: Array<{
  office: StubOffice;
  path: string;
  kind: "REGION" | "MC";
}> = [
  { office: OFFICES.region, path: "/ai/testing-region", kind: "REGION" },
  { office: OFFICES.mc, path: "/ai/testing-region/testonia", kind: "MC" },
  { office: OFFICES.farMc, path: "/ai/testing-region/farland", kind: "MC" },
];

/**
 * The eight position classes, then the refusal cases. `gis_down` isn't a
 * person — it makes the stub unreachable, exercising the fail-closed branch.
 */
export type PersonaKey =
  | "pai"
  | "ai_vp"
  | "ai_manager"
  | "mc_president"
  | "mc_vp"
  | "lc_president"
  | "lc_vp"
  | "member"
  | "far_mc_president"
  | "far_member"
  | "tag_mismatch"
  | "unknown_title"
  | "positionless"
  | "gis_down";

type PersonaSpec = {
  fullName: string;
  /** `[GIS role.name, office]` pairs. Empty means a person GIS knows but places nowhere. */
  positions: Array<[title: string, office: StubOffice]>;
  /** Why this persona exists, for the reader of a failing test. */
  note: string;
};

const PERSONAS: Record<Exclude<PersonaKey, "gis_down">, PersonaSpec> = {
  pai: {
    fullName: "Test PAI",
    positions: [["PAI", OFFICES.ai]],
    note: "Locked at full access in code; the anti-lockout floor.",
  },
  ai_vp: {
    fullName: "Test AIVP",
    positions: [["AIVP", OFFICES.ai]],
    note: "Locked at full access in code, same as PAI.",
  },
  ai_manager: {
    fullName: "Test AI Manager",
    positions: [["AI Manager", OFFICES.ai]],
    note: "Global reach, but an ordinary editable row in the matrix.",
  },
  mc_president: {
    fullName: "Test MCP",
    positions: [["MCP", OFFICES.mc]],
    note: "Moderation and promotion authority over its own MC subtree.",
  },
  mc_vp: {
    fullName: "Test MCVP",
    positions: [["MCVP", OFFICES.mc]],
    note: "Approves posts from anywhere beneath its MC, including both LCs.",
  },
  lc_president: {
    fullName: "Test LCP",
    positions: [["LCP", OFFICES.otherLc]],
    note: "Placed in the second LC so the suite has an entity outside the member's chain.",
  },
  lc_vp: {
    fullName: "Test LCVP",
    positions: [["LCVP", OFFICES.lc]],
    note: "Publishes; cannot approve, and cannot target beyond its own LC.",
  },
  member: {
    fullName: "Test Member",
    positions: [["Member", OFFICES.lc]],
    note: "Reads and engages. Sits in the same LC as lc_vp, so it can see what lc_vp publishes.",
  },

  // Same two classes at a different MC — how "invisible until promoted" is
  // asserted against a real boundary, not nothing.
  far_mc_president: {
    fullName: "Test Far MCP",
    positions: [["MCP", OFFICES.farMc]],
    note: "An MCP of the other MC. Its promotion budget is separate from Testonia's.",
  },
  far_member: {
    fullName: "Test Far Member",
    positions: [["Member", OFFICES.farLc]],
    note: "Reads from inside the other MC. Sees a Testonia post only once it is promoted.",
  },

  tag_mismatch: {
    fullName: "Test Tag Mismatch",
    positions: [["MCVP", OFFICES.lc]],
    note: "An MC title at an LC-tagged office. The two axes disagree, so the position is denied.",
  },
  unknown_title: {
    fullName: "Test Unknown Title",
    positions: [["MCVP Marketing", OFFICES.mc]],
    note: "Titles are matched for equality, never containment — 'MCVP Marketing' is not 'MCVP'.",
  },
  positionless: {
    fullName: "Test Positionless",
    positions: [],
    note: "A real GIS state. No position means no authority, which means no sign-in.",
  },
};

export const PERSONA_KEYS = [
  ...(Object.keys(PERSONAS) as Array<Exclude<PersonaKey, "gis_down">>),
  "gis_down" as const,
];

/**
 * One persona per position class — not every persona that can sign in.
 * far_mc_president/far_member duplicate two classes at another MC.
 */
export const SIGNED_IN_PERSONAS = [
  "pai",
  "ai_vp",
  "ai_manager",
  "mc_president",
  "mc_vp",
  "lc_president",
  "lc_vp",
  "member",
] as const;

export function isPersona(value: string): value is PersonaKey {
  return (PERSONA_KEYS as readonly string[]).includes(value);
}

/**
 * Every suite-created GIS person id starts with this; real ids are numeric.
 * cleanup.ts deletes on this prefix, so teardown can't touch real members.
 */
export const E2E_PERSON_ID_PREFIX = "e2e-";

/**
 * Office ids the suite materialises as entities. `ai` is excluded — it's
 * the seed-owned root, not suite-created, so teardown must leave it alone.
 */
export const E2E_OFFICE_IDS: string[] = Object.entries(OFFICES)
  .filter(([key]) => key !== "ai")
  .map(([, office]) => office.id);

/**
 * `isolate` gives a persona its own GIS person/Pulse account. Quota is per
 * author per period, so publish specs must not share one.
 */
export function personIdFor(persona: PersonaKey, isolate?: string): string {
  return isolate
    ? `${E2E_PERSON_ID_PREFIX}${persona}-${isolate}`
    : `${E2E_PERSON_ID_PREFIX}${persona}`;
}

/** The `currentPerson` payload GIS would return for this persona. */
export function personFor(persona: Exclude<PersonaKey, "gis_down">, isolate?: string) {
  const spec = PERSONAS[persona];
  const id = personIdFor(persona, isolate);

  return {
    id,
    full_name: spec.fullName,
    email: `${id}@e2e.invalid`,
    profile_photo: null,
    current_positions: spec.positions.map(([title, office], index) => ({
      // Position ids are stable per persona so a second sign-in reconciles the
      // same grant rather than creating a parallel one.
      id: `${id}-pos-${index}`,
      start_date: "2026-07-01",
      end_date: null,
      office,
      role: { id: `role-${title.replace(/\s+/g, "-").toLowerCase()}`, name: title },
    })),
  };
}

export function noteFor(persona: Exclude<PersonaKey, "gis_down">): string {
  return PERSONAS[persona].note;
}
