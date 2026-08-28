import { describe, expect, it } from "vitest";

import {
  isPersona,
  noteFor,
  OFFICES,
  PERSONA_KEYS,
  personFor,
  personIdFor,
  SIGNED_IN_PERSONAS,
} from "@/e2e/gis-stub/fixtures";
import { derivePositionGrants } from "@/lib/rbac/position-mapping";
import { __testing } from "@/server-utils/gis";

const { currentPersonSchema } = __testing;

/**
 * Pins fixtures against the production schema/cross-check so a GIS
 * response-shape drift fails in CI, not silently in production.
 */

const PEOPLE = PERSONA_KEYS.filter((key) => key !== "gis_down");

describe("GIS fixtures against the production schema", () => {
  it.each(PEOPLE)("%s parses as a currentPerson response", (persona) => {
    const result = currentPersonSchema.safeParse(personFor(persona));

    if (!result.success) {
      throw new Error(`${persona} (${noteFor(persona)}) failed to parse:\n${result.error.message}`);
    }
    expect(result.data.id).toBe(personIdFor(persona));
  });

  it("isolation produces a distinct person, which is what keeps quota per author", () => {
    const plain = currentPersonSchema.parse(personFor("lc_vp"));
    const isolated = currentPersonSchema.parse(personFor("lc_vp", "abc123"));

    expect(isolated.id).not.toBe(plain.id);
    expect(isolated.email).toContain("abc123");
    // Same positions, different account: the isolation must not change what the
    // persona is allowed to do, or specs would be testing different roles.
    expect(isolated.current_positions.map((p) => p.role?.name)).toEqual(
      plain.current_positions.map((p) => p.role?.name)
    );
  });

  it("covers all eight position classes and nothing else", () => {
    expect([...SIGNED_IN_PERSONAS].sort()).toEqual(
      [
        "ai_manager",
        "ai_vp",
        "lc_president",
        "lc_vp",
        "mc_president",
        "mc_vp",
        "member",
        "pai",
      ].sort()
    );
  });

  it("rejects a persona name it does not define", () => {
    expect(isPersona("platform_admin")).toBe(false);
    expect(isPersona("member")).toBe(true);
  });
});

describe("GIS fixtures against the cross-check", () => {
  function grantsFor(persona: (typeof PEOPLE)[number]) {
    const person = currentPersonSchema.parse(personFor(persona));
    return derivePositionGrants(
      person.current_positions.map((position) => ({
        positionId: position.id ?? null,
        roleName: position.role?.name ?? null,
        officeId: position.office?.id ?? null,
        officeName: position.office?.name ?? null,
        officeTag: position.office?.tag ?? null,
      }))
    );
  }

  it.each(SIGNED_IN_PERSONAS)("%s resolves to exactly its own position class", (persona) => {
    const { grants, denied } = grantsFor(persona);
    expect(denied).toEqual([]);
    expect(grants.map((g) => g.role)).toEqual([persona]);
  });

  it("denies an MC title held at an LC-tagged office", () => {
    const { grants, denied } = grantsFor("tag_mismatch");
    expect(grants).toEqual([]);
    expect(denied.map((d) => d.reason)).toEqual(["tag_mismatch"]);
  });

  it("denies a title that merely contains a recognised one", () => {
    const { grants, denied } = grantsFor("unknown_title");
    expect(grants).toEqual([]);
    expect(denied.map((d) => d.reason)).toEqual(["unrecognised_title"]);
  });

  it("resolves nothing for a person GIS places nowhere", () => {
    const { grants, denied } = grantsFor("positionless");
    expect(grants).toEqual([]);
    expect(denied).toEqual([]);
  });
});

describe("the fixture office tree", () => {
  it("keeps the AI office identical to the seeded entity root", () => {
    // resolveOfficeEntity rewrites an entity whose name or tag has drifted, and
    // the suite has no business renaming the root out from under the seed.
    expect(OFFICES.ai).toMatchObject({ id: "1", name: "AIESEC International", tag: "AI" });
  });

  it("puts two LCs under one MC, so 'outside your scope' is a real place", () => {
    expect(OFFICES.lc.parent).toEqual({ id: OFFICES.mc.id });
    expect(OFFICES.otherLc.parent).toEqual({ id: OFFICES.mc.id });
    expect(OFFICES.lc.id).not.toBe(OFFICES.otherLc.id);
  });
});
