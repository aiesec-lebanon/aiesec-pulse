import { describe, expect, it } from "vitest";

import { EntityKind, PostLevel, ScopeType } from "@/app/generated/prisma/enums";
import { localRootOf, type ScopeSet, visibilityFilter } from "@/lib/org/scope";

const AI = { id: "ent_ai", kind: EntityKind.GLOBAL, path: "/ai" };
const MENA = { id: "ent_mena", kind: EntityKind.REGION, path: "/ai/mena" };
const LEBANON = { id: "ent_lb", kind: EntityKind.MC, path: "/ai/mena/lb" };
const AUB = { id: "ent_aub", kind: EntityKind.LC, path: "/ai/mena/lb/aub" };

describe("localRootOf", () => {
  it("roots an LC member at their MC, not at their own LC", () => {
    // The ancestor chain never contains sibling LCs, so an LC member could
    // not see the LC next door before post level.
    expect(localRootOf([AI, MENA, LEBANON, AUB], AUB.id)).toBe(LEBANON);
  });

  it("roots an MC member at their own MC", () => {
    expect(localRootOf([AI, MENA, LEBANON], LEBANON.id)).toBe(LEBANON);
  });

  it("roots a viewer above the MC tier at their own entity", () => {
    expect(localRootOf([AI, MENA], MENA.id)).toBe(MENA);
    expect(localRootOf([AI], AI.id)).toBe(AI);
  });

  it("has no answer for a viewer who is not on the chain it was given", () => {
    expect(localRootOf([AI, MENA], AUB.id)).toBeNull();
  });
});

const LOCAL_SCOPE: ScopeSet = {
  entityIds: [LEBANON.id, AUB.id, MENA.id],
  unrestricted: false,
  primaryEntityId: AUB.id,
  primaryEntityPath: AUB.path,
  regionEntityId: MENA.id,
};

describe("visibilityFilter", () => {
  it("is the union of the network arm and the local arm", () => {
    const filter = visibilityFilter(LOCAL_SCOPE);
    expect(filter.OR).toHaveLength(2);
    expect(filter.OR?.[0]).toEqual({ level: PostLevel.NETWORK });
  });

  it("matches a local post on a GLOBAL audience row or an in-scope entity", () => {
    const localArm = visibilityFilter(LOCAL_SCOPE).OR?.[1];
    expect(localArm).toEqual({
      audiences: {
        some: {
          OR: [
            { scopeType: ScopeType.GLOBAL },
            { entityId: { in: [LEBANON.id, AUB.id, MENA.id] } },
          ],
        },
      },
    });
  });

  it("drops the entity arm rather than matching an empty list", () => {
    // `entityId: { in: [] }` matches nothing only by accident; falling
    // through to the GLOBAL arm here is on purpose.
    const filter = visibilityFilter({ ...LOCAL_SCOPE, entityIds: [] });
    expect(filter.OR?.[1]).toEqual({
      audiences: { some: { OR: [{ scopeType: ScopeType.GLOBAL }] } },
    });
  });

  it("filters nothing for a viewer at the global root", () => {
    // Every entity is already beneath them, so both arms would match
    // everything; an empty filter is that answer without the entity list.
    expect(visibilityFilter({ ...LOCAL_SCOPE, unrestricted: true, entityIds: [] })).toEqual({});
  });

  it("never narrows a NETWORK post by audience", () => {
    // Promotion raises the ceiling; ANDing the two arms instead of ORing
    // would hide a promoted LC post from the network it was just promoted to.
    const filter = visibilityFilter(LOCAL_SCOPE);
    expect(filter.AND).toBeUndefined();
    expect(filter.OR?.[0]).not.toHaveProperty("audiences");
  });
});
