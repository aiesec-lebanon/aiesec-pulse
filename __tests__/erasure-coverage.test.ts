import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ERASURE_COVERAGE } from "@/lib/privacy/erasure-coverage";

// A relation added to User without an erasure decision is personal data that
// survives an erasure request. This reads the schema itself, so it cannot drift.
function userRelations(): string[] {
  const schema = readFileSync(join(__dirname, "..", "prisma", "schema.prisma"), "utf8");
  const models = new Set([...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]));
  const body = schema.match(/^model User \{([\s\S]*?)^\}/m)?.[1] ?? "";
  return body
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([name, type]) => name && type && models.has(type.replace(/[?[\]]/g, "")))
    .map(([name]) => name);
}

describe("erasure coverage", () => {
  it("has a decision for every relation of User", () => {
    const relations = userRelations();
    expect(relations.length).toBeGreaterThan(10);
    expect(relations.filter((r) => !(r in ERASURE_COVERAGE))).toEqual([]);
  });

  it("lists no relation the schema does not have", () => {
    const relations = new Set(userRelations());
    expect(Object.keys(ERASURE_COVERAGE).filter((r) => !relations.has(r))).toEqual([]);
  });
});
