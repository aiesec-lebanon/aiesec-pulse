import { beforeEach, describe, expect, it, vi } from "vitest";

import { derivePositionGrants, type PositionInput } from "@/lib/rbac/position-mapping";

// The tag/title cross-check is the whole security boundary; everything
// downstream trusts a grant only exists because both agreed. These cases
// must NOT produce one.

const position = (over: Partial<PositionInput> = {}): PositionInput => ({
  positionId: "p1",
  roleName: "MCVP",
  officeId: "101",
  officeName: "AIESEC in Lebanon",
  officeTag: "MC",
  ...over,
});

describe("the two axes must agree", () => {
  it("denies an MC title held at an LC office", () => {
    const { grants, denied } = derivePositionGrants([
      position({ roleName: "MCVP", officeTag: "LC" }),
    ]);
    expect(grants).toHaveLength(0);
    expect(denied[0]).toMatchObject({ reason: "tag_mismatch", expectedTag: "MC" });
  });

  it("denies an LC title held at an MC office", () => {
    const { grants, denied } = derivePositionGrants([
      position({ roleName: "LCP", officeTag: "MC" }),
    ]);
    expect(grants).toHaveLength(0);
    expect(denied[0]).toMatchObject({ reason: "tag_mismatch", expectedTag: "LC" });
  });

  it("denies an AI title held anywhere but an AI office", () => {
    for (const roleName of ["PAI", "AIVP", "AI Manager"]) {
      const { grants } = derivePositionGrants([position({ roleName, officeTag: "MC" })]);
      expect(grants, `${roleName} at an MC office`).toHaveLength(0);
    }
  });

  it("denies a recognised title at an office whose tag we cannot read", () => {
    // An office tagged with a country code is real data, not a bug — failing
    // closed here is the only outcome that can't over-grant if the model is wrong.
    for (const officeTag of ["LB", "", null]) {
      const { grants, denied } = derivePositionGrants([position({ officeTag })]);
      expect(grants, `tag ${String(officeTag)}`).toHaveLength(0);
      expect(denied[0].reason).toBe("unknown_office_tag");
    }
  });

  it("does not let a `member` position be denied for its office tag", () => {
    // The one class that sits at any level. Everything else declares a tag.
    const { grants } = derivePositionGrants([position({ roleName: "Member", officeTag: "LB" })]);
    expect(grants.map((g) => g.role)).toEqual(["member"]);
  });

  it("denies rather than alerting quietly — every denial carries title, office and tag", () => {
    const { denied } = derivePositionGrants([
      position({ roleName: "MCVP", officeTag: "LC", officeName: "AIESEC in Beirut" }),
    ]);
    expect(denied[0]).toMatchObject({
      roleName: "MCVP",
      officeId: "101",
      officeName: "AIESEC in Beirut",
      officeTag: "LC",
    });
  });
});

describe("titles outside the closed list", () => {
  it("matches nothing for a decorated or renamed position", () => {
    // A prefix/substring match would have granted `MCVP Marketing` and
    // `MCPartner`; the closed list denies both on purpose.
    for (const roleName of [
      "MCVP Marketing",
      "MCVP elect",
      "MCPartner",
      "Deputy MCP",
      "Member Committee Vice President for Talent Management",
      "National Director",
      "Chief Vibes Officer",
    ]) {
      const { grants, denied } = derivePositionGrants([position({ roleName })]);
      expect(grants, `'${roleName}' should grant nothing`).toHaveLength(0);
      expect(denied[0].reason).toBe("unrecognised_title");
    }
  });

  it("denies a position with no title and a position with no office", () => {
    expect(derivePositionGrants([position({ roleName: null })]).denied[0].reason).toBe("no_title");
    expect(derivePositionGrants([position({ roleName: "  " })]).denied[0].reason).toBe("no_title");
    expect(derivePositionGrants([position({ officeId: null })]).denied[0].reason).toBe("no_office");
  });
});

describe("denial is per-position, not per-user", () => {
  it("keeps the recognised position when the other one is denied", () => {
    const { grants, denied } = derivePositionGrants([
      position({ positionId: "bad", roleName: "MCVP Marketing" }),
      position({ positionId: "good", roleName: "LCP", officeId: "500", officeTag: "LC" }),
    ]);
    expect(grants).toEqual([
      {
        role: "lc_president",
        positionId: "good",
        officeId: "500",
        scopeOfficeId: "500",
        matchedTitle: "lcp",
      },
    ]);
    expect(denied.map((d) => d.positionId)).toEqual(["bad"]);
  });

  it("keeps the good one even when the bad one is a tag mismatch at the same office", () => {
    const { grants } = derivePositionGrants([
      position({ positionId: "bad", roleName: "LCVP", officeTag: "MC" }),
      position({ positionId: "good", roleName: "MCVP", officeTag: "MC" }),
    ]);
    expect(grants.map((g) => g.role)).toEqual(["mc_vp"]);
  });
});

// ── Sign-in refusal ─────────────────────────────────────────────────────────

const dbMock = {
  user: { findUnique: vi.fn(), upsert: vi.fn() },
  entity: { findUnique: vi.fn() },
  role: { findUnique: vi.fn() },
  roleGrant: { findMany: vi.fn(), updateMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/redis", () => ({ invalidateUserAuthorisation: vi.fn() }));
vi.mock("@/lib/org/entities", () => ({
  ROOT_ENTITY_ID: "ent_root_ai",
  resolveOfficeEntity: vi.fn(async () => ({ id: "ent_1", path: "/ai/mena/lb" })),
}));
vi.mock("@/lib/rbac/grants", () => ({
  upsertRoleGrant: vi.fn(async () => ({ id: "grant_1", created: true })),
}));
vi.mock("@/server-utils/gis", () => ({ warnIfPositionless: vi.fn() }));

const { syncIdentityFromGis } = await import("@/lib/auth/identity");

type GisPersonLike = Parameters<typeof syncIdentityFromGis>[0];

const person = (roleName: string, tag: string | null): GisPersonLike =>
  ({
    id: "gis-1",
    full_name: "Test Person",
    email: "test@aiesec.invalid",
    profile_photo: null,
    current_positions: [
      {
        id: "pos-1",
        office: { id: "101", name: "AIESEC in Lebanon", tag, parent: null, country: "LB" },
        role: { id: "r1", name: roleName },
        start_date: null,
        end_date: null,
      },
    ],
  }) as GisPersonLike;

describe("a person with nothing recognised cannot sign in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.entity.findUnique.mockResolvedValue({ id: "ent_1" });
    dbMock.role.findUnique.mockResolvedValue({ id: "role_1" });
    dbMock.roleGrant.findMany.mockResolvedValue([]);
  });

  it("refuses, and leaves no account behind for having tried", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);

    const result = await syncIdentityFromGis(person("MCVP Marketing", "MC"));

    expect(result.recognisedPositions).toBe(0);
    expect(result.user).toBeNull();
    expect(dbMock.user.upsert).not.toHaveBeenCalled();
  });

  it("refuses on a tag mismatch just as firmly as on an unknown title", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);

    const result = await syncIdentityFromGis(person("MCVP", "LC"));

    expect(result.recognisedPositions).toBe(0);
    expect(result.denied[0].reason).toBe("tag_mismatch");
  });

  it("still reconciles an existing account down to zero, so old grants stop working", async () => {
    // Losing every position is exactly the case where the previous term's
    // grants must be expired rather than left to run.
    dbMock.user.findUnique.mockResolvedValue({ id: "u1", primaryEntityId: "ent_1" });
    dbMock.user.upsert.mockResolvedValue({ id: "u1", status: "ACTIVE", primaryEntityId: "ent_1" });
    dbMock.roleGrant.findMany.mockResolvedValue([{ id: "stale_1" }]);

    const result = await syncIdentityFromGis(person("Chief Vibes Officer", "MC"));

    expect(result.recognisedPositions).toBe(0);
    expect(result.user).not.toBeNull();
    expect(result.grantsExpired).toBe(1);
    expect(dbMock.roleGrant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ endsAt: expect.any(Date) }) })
    );
  });

  it("signs in the member who holds one good position among bad ones", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);
    dbMock.user.upsert.mockResolvedValue({ id: "u1", status: "ACTIVE", primaryEntityId: "ent_1" });

    const mixed = person("MCVP", "MC");
    mixed.current_positions.push({
      id: "pos-2",
      office: { id: "101", name: "AIESEC in Lebanon", tag: "MC", parent: null, country: "LB" },
      role: { id: "r2", name: "MCPartner" },
      start_date: null,
      end_date: null,
    });

    const result = await syncIdentityFromGis(mixed);

    expect(result.recognisedPositions).toBe(1);
    expect(result.denied.map((d) => d.reason)).toEqual(["unrecognised_title"]);
    expect(dbMock.user.upsert).toHaveBeenCalled();
  });
});
