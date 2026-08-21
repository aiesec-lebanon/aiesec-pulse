// GIS `currentPerson` payloads, one per AIESEC position class plus the cases
// that must be refused. These are the wire shape GIS actually returns —
// snake_case, ids that may arrive as strings or numbers, `parent` on the office
// — not a Pulse-shaped convenience object. `__tests__/gis-contract.test.ts`
// parses every one of them through the live Zod schema in `server-utils/gis.ts`,
// so a GIS shape change that would break production fails CI instead.
//
// Nothing here is imported by application code. The e2e suite reaches these
// through a stub server that answers as GIS (see ./server.ts); the app under
// test is pointed at that server by environment variable and is unaware it is
// talking to anything other than the real thing.

/** The GIS office shape, as the `currentPerson` query selects it. */
export type StubOffice = {
  id: string;
  name: string;
  tag: string | null;
  country: string | null;
  parent: { id: string } | null;
};

/**
 * The office tree, at the real AIESEC depth: AI → region → MC → LC.
 *
 * `ai` is the office the seed already created as the entity root
 * (`gisOfficeId: "1"`), so name and tag match it exactly — `resolveOfficeEntity`
 * updates an entity whose name or tag has drifted, and the suite has no business
 * renaming the root.
 *
 * Three things this shape exists to make testable, none of which a flatter or
 * smaller tree can:
 *
 * - **Two LCs under one MC** (`lc`, `otherLc`). Post level makes an LC's news
 *   reach its sister LC automatically (context.md §7.2), which a suite with one
 *   LC cannot tell from no scoping at all.
 * - **Two MCs under one region** (`mc`, `farMc`). This is what "outside the
 *   viewer's scope" means now that the local scope set is an MC subtree: a
 *   sibling LC is inside it, another MC is not.
 * - **A real region tier.** `Entity.kind` is derived from path depth
 *   (`kindForDepth`), so in a three-level tree the office tagged MC would be
 *   stored as a REGION and the promotion rules — which resolve the viewer's
 *   nearest `EntityKind.MC` ancestor — would be testing the wrong node.
 *   Nobody holds a position at `region`; it exists so the depths are honest.
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
 * The interior offices, root-first, with the path and kind Pulse's own
 * derivation would give them.
 *
 * An office enters the tree when someone holding a position there signs in, and
 * `resolveOfficeEntity` parks an office whose parent is not there yet directly
 * under the root — so which spec happens to run first would decide the shape of
 * the tree, and therefore what every scope rule computes. These three are
 * created up front by `e2e/cleanup.ts` in globalSetup instead. The leaves are
 * deliberately left out: they arrive through the production path at login, which
 * is worth continuing to exercise, and by then their parents exist.
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
 * The eight position classes, then the refusals.
 *
 * `gis_down` is not a person at all — it makes the stub answer as an unreachable
 * directory, which is the only way to exercise the callback's fail-closed branch
 * end to end.
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

  // ── The second MC ──────────────────────────────────────────────────────────
  // Same two classes, a whole MC away. Post level is the only thing that can
  // carry a post across this boundary, so these two are how "invisible until
  // promoted" is asserted against something rather than against nothing.
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

  // ── The refusals ───────────────────────────────────────────────────────────
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
 * One persona per position class, for the specs that assert what a class may do.
 * Not every persona that signs in successfully: `far_mc_president` and
 * `far_member` are the same two classes at the other MC, and listing them here
 * would say Pulse recognises ten classes when it recognises eight.
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
 * Every GIS person id the suite invents starts with this, and no real one can:
 * GIS person ids are numeric. That makes the prefix a safe discriminator for
 * "rows this suite created" — which is what e2e/cleanup.ts deletes on, so the
 * teardown can never reach an account belonging to a real member.
 */
export const E2E_PERSON_ID_PREFIX = "e2e-";

/**
 * The GIS office ids the suite causes Pulse to materialise as entities. `ai` is
 * excluded deliberately: it is the root the seed owns (gisOfficeId "1"), not
 * something a test run created, and the teardown must leave it alone.
 */
export const E2E_OFFICE_IDS: string[] = Object.entries(OFFICES)
  .filter(([key]) => key !== "ai")
  .map(([, office]) => office.id);

/**
 * `isolate` gives a persona its own GIS person, and therefore its own Pulse
 * account. Publishing quota is per author per period, so specs that publish must
 * not share one or the suite becomes order-dependent.
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
