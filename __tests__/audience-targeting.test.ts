import { describe, expect, it } from "vitest";

import { ScopeType } from "@/app/generated/prisma/enums";
import { decideAudienceForSubmission } from "@/lib/org/scope";

// context.md §7.2: "target audience beyond own scope" is ❌ for
// entity_publisher/entity_editor, ✅ for global_publisher/platform_admin.
// availableAudiencesFor already encodes that as "fixed" vs "open" — these
// tests exercise the boundary decideAudienceForSubmission enforces given
// each, independent of any real entity or database.

const OWN_ENTITY = "ent_lc_beirut";
const OTHER_ENTITY = "ent_lc_cairo";
const REGION = "ent_region_mena";

describe("decideAudienceForSubmission — fixed (entity_publisher / entity_editor)", () => {
  const fixed = { kind: "fixed" as const, entityId: OWN_ENTITY, label: "AIESEC in Lebanon" };

  it("accepts an absent submission, defaulting to the publisher's own entity", () => {
    const result = decideAudienceForSubmission(fixed, undefined);
    expect(result).toEqual({ ok: true, scopeType: ScopeType.ENTITY, entityId: OWN_ENTITY });
  });

  it("accepts a submission that already names the publisher's own entity", () => {
    const result = decideAudienceForSubmission(fixed, {
      scopeType: ScopeType.ENTITY,
      entityId: OWN_ENTITY,
    });
    expect(result).toEqual({ ok: true, scopeType: ScopeType.ENTITY, entityId: OWN_ENTITY });
  });

  it("rejects a GLOBAL audience, even if the client sent it directly", () => {
    const result = decideAudienceForSubmission(fixed, {
      scopeType: ScopeType.GLOBAL,
      entityId: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a REGION audience", () => {
    const result = decideAudienceForSubmission(fixed, {
      scopeType: ScopeType.REGION,
      entityId: REGION,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an ENTITY audience naming a different entity — not silently narrowed to their own", () => {
    const result = decideAudienceForSubmission(fixed, {
      scopeType: ScopeType.ENTITY,
      entityId: OTHER_ENTITY,
    });
    expect(result.ok).toBe(false);
  });
});

describe("decideAudienceForSubmission — open (global_publisher / platform_admin)", () => {
  const open = { kind: "open" as const, regions: [{ id: REGION, name: "MENA" }] };

  it("defaults to GLOBAL when nothing was submitted, preserving the pre-M7 default", () => {
    const result = decideAudienceForSubmission(open, undefined);
    expect(result).toEqual({ ok: true, scopeType: ScopeType.GLOBAL, entityId: null });
  });

  it("succeeds targeting GLOBAL explicitly", () => {
    const result = decideAudienceForSubmission(open, {
      scopeType: ScopeType.GLOBAL,
      entityId: null,
    });
    expect(result).toEqual({ ok: true, scopeType: ScopeType.GLOBAL, entityId: null });
  });

  it("succeeds targeting a region", () => {
    const result = decideAudienceForSubmission(open, {
      scopeType: ScopeType.REGION,
      entityId: REGION,
    });
    expect(result).toEqual({ ok: true, scopeType: ScopeType.REGION, entityId: REGION });
  });

  it("succeeds targeting any named entity, not just their own", () => {
    const result = decideAudienceForSubmission(open, {
      scopeType: ScopeType.ENTITY,
      entityId: OTHER_ENTITY,
    });
    expect(result).toEqual({ ok: true, scopeType: ScopeType.ENTITY, entityId: OTHER_ENTITY });
  });

  it("rejects a REGION/ENTITY submission with no entity chosen", () => {
    const result = decideAudienceForSubmission(open, {
      scopeType: ScopeType.ENTITY,
      entityId: null,
    });
    expect(result.ok).toBe(false);
  });
});
