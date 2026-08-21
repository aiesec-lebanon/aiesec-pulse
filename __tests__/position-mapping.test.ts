import { describe, expect, it } from "vitest";

import {
  choosePrimaryOfficeId,
  classForTitle,
  derivePositionGrants,
  normaliseTag,
  normaliseTitle,
  POSITION_CLASSES,
  type PositionInput,
} from "@/lib/rbac/position-mapping";

const position = (over: Partial<PositionInput> = {}): PositionInput => ({
  positionId: "p1",
  roleName: "MCP",
  officeId: "101",
  officeName: "AIESEC in Lebanon",
  officeTag: "MC",
  ...over,
});

describe("normalisation", () => {
  it("trims, case-folds and collapses internal whitespace", () => {
    expect(normaliseTitle("  MCVP  ")).toBe("mcvp");
    expect(normaliseTitle("AI   Manager")).toBe("ai manager");
    expect(normaliseTitle("Ai Manager")).toBe("ai manager");
  });

  it("does nothing else — punctuation is not a separator here", () => {
    // Widening the normalisation widens the match surface of an authorisation
    // boundary, for a form AIESEC does not issue.
    expect(normaliseTitle("MCVP-Marketing")).toBe("mcvp-marketing");
    expect(classForTitle(normaliseTitle("MCVP-Marketing"))).toBeNull();
  });

  it("recognises the three office tags and nothing else", () => {
    expect(normaliseTag("mc")).toBe("MC");
    expect(normaliseTag(" AI ")).toBe("AI");
    expect(normaliseTag("LB")).toBeNull();
    expect(normaliseTag("")).toBeNull();
  });
});

describe("the closed list", () => {
  it("holds exactly the eight recognised titles", () => {
    expect(POSITION_CLASSES.map((c) => c.title)).toEqual([
      "pai",
      "aivp",
      "ai manager",
      "mcp",
      "mcvp",
      "lcp",
      "lcvp",
      "member",
    ]);
  });

  it("matches a title exactly, never as a prefix or a substring", () => {
    expect(classForTitle("mcp")?.role).toBe("mc_president");
    expect(classForTitle("mcp elect")).toBeNull();
    expect(classForTitle("mcpartner")).toBeNull();
    expect(classForTitle("deputy mcp")).toBeNull();
  });
});

describe("deriving grants from a position", () => {
  it("grants the class when tag and title agree", () => {
    const { grants, denied } = derivePositionGrants([position()]);
    expect(denied).toHaveLength(0);
    expect(grants).toEqual([
      {
        role: "mc_president",
        positionId: "p1",
        officeId: "101",
        scopeOfficeId: "101",
        matchedTitle: "mcp",
      },
    ]);
  });

  it("scopes MC and LC classes to their own office", () => {
    const { grants } = derivePositionGrants([
      position({ roleName: "LCVP", officeId: "500", officeTag: "LC" }),
    ]);
    expect(grants[0]).toMatchObject({ role: "lc_vp", scopeOfficeId: "500" });
  });

  it("gives AI classes and members global authority, not an office scope", () => {
    const { grants } = derivePositionGrants([
      position({ positionId: "a", roleName: "AIVP", officeId: "1", officeTag: "AI" }),
      position({ positionId: "b", roleName: "Member", officeId: "500", officeTag: "LC" }),
    ]);
    expect(grants.map((g) => [g.role, g.scopeOfficeId])).toEqual([
      ["ai_vp", null],
      ["member", null],
    ]);
    // The office is still carried, because it is what the member is attributed to.
    expect(grants[1].officeId).toBe("500");
  });

  it("keeps the recognised position when another one is denied", () => {
    const { grants, denied } = derivePositionGrants([
      position({ positionId: "a", roleName: "MCVP Marketing" }),
      position({ positionId: "b", roleName: "MCVP" }),
    ]);
    expect(grants.map((g) => g.role)).toEqual(["mc_vp"]);
    expect(denied.map((d) => d.positionId)).toEqual(["a"]);
  });

  it("issues one grant per office when a member leads two entities", () => {
    const { grants } = derivePositionGrants([
      position({ positionId: "a", roleName: "LCP", officeId: "500", officeTag: "LC" }),
      position({ positionId: "b", roleName: "MCVP", officeId: "101", officeTag: "MC" }),
    ]);
    expect(grants.map((g) => g.scopeOfficeId).sort()).toEqual(["101", "500"]);
  });

  it("de-duplicates two positions of the same class at the same office", () => {
    const { grants } = derivePositionGrants([
      position({ positionId: "a", roleName: "MCVP" }),
      position({ positionId: "b", roleName: "MCVP" }),
    ]);
    expect(grants).toHaveLength(1);
  });
});

describe("choosing a primary office", () => {
  it("prefers the more senior class regardless of GIS ordering", () => {
    const positions = [
      position({ positionId: "a", roleName: "LCVP", officeId: "500", officeTag: "LC" }),
      position({ positionId: "b", roleName: "MCP", officeId: "101", officeTag: "MC" }),
    ];
    // Taking current_positions[0] would pick the LC here.
    const forward = derivePositionGrants(positions).grants;
    const reversed = derivePositionGrants([...positions].reverse()).grants;
    expect(choosePrimaryOfficeId(forward)).toBe("101");
    expect(choosePrimaryOfficeId(reversed)).toBe("101");
  });

  it("is stable across GIS orderings when the class ties", () => {
    const positions = [
      position({ positionId: "a", roleName: "Member", officeId: "700", officeTag: "LC" }),
      position({ positionId: "b", roleName: "Member", officeId: "300", officeTag: "LC" }),
    ];
    // Both dedupe to one global `member` grant, so the office that survives has
    // to be the deterministic one rather than whichever GIS returned first.
    expect(choosePrimaryOfficeId(derivePositionGrants(positions).grants)).toBe("300");
    expect(choosePrimaryOfficeId(derivePositionGrants([...positions].reverse()).grants)).toBe(
      "300"
    );
  });

  it("returns null when nothing was recognised", () => {
    expect(choosePrimaryOfficeId([])).toBeNull();
  });
});
