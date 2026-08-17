import { describe, expect, it } from "vitest";

import {
  choosePrimaryPosition,
  derivePublishingGrants,
  GLOBAL_OFFICE_ID,
  normaliseTitle,
  type PositionInput,
} from "@/lib/rbac/position-mapping";

const position = (over: Partial<PositionInput> = {}): PositionInput => ({
  positionId: "p1",
  roleName: "MCP",
  officeId: "101",
  officeName: "AIESEC in Lebanon",
  officeTag: "LB",
  officeDepth: 3,
  ...over,
});

describe("normaliseTitle", () => {
  it("flattens case, punctuation and separators", () => {
    expect(normaliseTitle("MCVP – Marketing & Comms")).toBe("mcvp marketing comms");
    expect(normaliseTitle("  LCP  ")).toBe("lcp");
  });

  it("strips diacritics", () => {
    expect(normaliseTitle("Président")).toBe("president");
  });
});

describe("title matching against free text", () => {
  it("matches a decorated MCVP title rather than falling through to member", () => {
    const { grants } = derivePublishingGrants([position({ roleName: "MCVP Marketing" })]);
    expect(grants).toHaveLength(1);
    expect(grants[0].role).toBe("entity_publisher");
  });

  it("matches presidents and vice presidents written out in full", () => {
    const { grants } = derivePublishingGrants([
      position({ roleName: "Member Committee Vice President for Talent Management" }),
    ]);
    expect(grants[0]?.role).toBe("entity_publisher");
  });

  it("does not match a title that merely starts with the same letters", () => {
    const { grants, unmatched } = derivePublishingGrants([
      position({ roleName: "MCPartner Liaison" }),
    ]);
    expect(grants).toHaveLength(0);
    expect(unmatched).toHaveLength(1);
  });

  it("reports unmatched titles instead of failing silently", () => {
    // A silent miss looks like a bug, so a renamed position
    // quietly removed someone's publishing rights.
    const { unmatched } = derivePublishingGrants([position({ roleName: "Chief Vibes Officer" })]);
    expect(unmatched).toEqual([
      { positionId: "p1", roleName: "Chief Vibes Officer", officeId: "101" },
    ]);
  });

  it("grants nothing for an ordinary member with no leadership position", () => {
    const { grants } = derivePublishingGrants([position({ roleName: "Member" })]);
    expect(grants).toHaveLength(0);
  });
});

describe("grant scoping", () => {
  it("scopes an entity publisher to the office on the position", () => {
    const { grants } = derivePublishingGrants([position({ roleName: "MCVP", officeId: "202" })]);
    expect(grants[0]).toMatchObject({ role: "entity_publisher", officeId: "202" });
  });

  it("only grants global publishing at the global office", () => {
    const atMc = derivePublishingGrants([
      position({ roleName: "Vice President", officeId: "101" }),
    ]);
    expect(atMc.grants.some((g) => g.role === "global_publisher")).toBe(false);

    const atAi = derivePublishingGrants([
      position({ roleName: "Vice President", officeId: GLOBAL_OFFICE_ID, officeDepth: 1 }),
    ]);
    expect(atAi.grants[0]?.role).toBe("global_publisher");
    expect(atAi.grants[0]?.officeId).toBeNull();
  });

  it("de-duplicates several positions implying the same role and office", () => {
    const { grants } = derivePublishingGrants([
      position({ positionId: "a", roleName: "MCVP Marketing" }),
      position({ positionId: "b", roleName: "MCVP Talent Management" }),
    ]);
    expect(grants).toHaveLength(1);
  });

  it("issues one grant per office when a member leads two entities", () => {
    const { grants } = derivePublishingGrants([
      position({ positionId: "a", roleName: "LCP", officeId: "500", officeDepth: 4 }),
      position({ positionId: "b", roleName: "MCVP", officeId: "101" }),
    ]);
    expect(grants.map((g) => g.officeId).sort()).toEqual(["101", "500"]);
  });
});

describe("choosing a primary position", () => {
  it("prefers the higher-ranked title regardless of GIS ordering", () => {
    const positions = [
      position({ positionId: "a", roleName: "LCVP Marketing", officeId: "500", officeDepth: 4 }),
      position({ positionId: "b", roleName: "MCP", officeId: "101", officeDepth: 3 }),
    ];
    // Taking current_positions[0] would pick the LCVP here.
    expect(choosePrimaryPosition(positions)?.positionId).toBe("b");
    expect(choosePrimaryPosition([...positions].reverse())?.positionId).toBe("b");
  });

  it("prefers the deeper office when titles rank equally", () => {
    const positions = [
      position({ positionId: "a", roleName: "Member", officeId: "101", officeDepth: 3 }),
      position({ positionId: "b", roleName: "Member", officeId: "500", officeDepth: 4 }),
    ];
    expect(choosePrimaryPosition(positions)?.positionId).toBe("b");
  });

  it("is stable across GIS orderings when everything else ties", () => {
    const positions = [
      position({ positionId: "a", roleName: "Member", officeId: "700", officeDepth: 4 }),
      position({ positionId: "b", roleName: "Member", officeId: "300", officeDepth: 4 }),
    ];
    expect(choosePrimaryPosition(positions)?.officeId).toBe("300");
    expect(choosePrimaryPosition([...positions].reverse())?.officeId).toBe("300");
  });

  it("returns null when there are no positions with an office", () => {
    expect(choosePrimaryPosition([])).toBeNull();
    expect(choosePrimaryPosition([position({ officeId: null })])).toBeNull();
  });
});

describe("roles that must never be derived from GIS", () => {
  it("never derives editor, moderator or admin from a position title", () => {
    // Platform-only roles are granted manually. Deriving a
    // moderator from free text would make trust & safety authority a function of
    // someone renaming a role in EXPA.
    const titles = [
      "MC Comms Manager",
      "Trust and Safety Lead",
      "Platform Administrator",
      "IM Director",
    ];
    for (const roleName of titles) {
      const { grants } = derivePublishingGrants([position({ roleName })]);
      for (const grant of grants) {
        expect(["entity_publisher", "global_publisher"]).toContain(grant.role);
      }
    }
  });
});
