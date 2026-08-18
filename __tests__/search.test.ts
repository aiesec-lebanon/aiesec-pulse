import { describe, expect, it } from "vitest";

import { parseSearchFilters, parseSnippet } from "@/lib/search";

// parseSnippet decodes the charCode(1)/charCode(2) markers ts_headline is
// asked to wrap matches in (lib/search.ts) instead of HTML — these tests
// build that marked-up string by hand, the same shape ts_headline returns.
const START = String.fromCharCode(1);
const STOP = String.fromCharCode(2);

describe("parseSnippet", () => {
  it("returns a single unhighlighted part when there are no markers", () => {
    expect(parseSnippet("plain text, no match")).toEqual([
      { text: "plain text, no match", highlighted: false },
    ]);
  });

  it("highlights a single marked match in the middle of the text", () => {
    expect(parseSnippet(`before ${START}match${STOP} after`)).toEqual([
      { text: "before ", highlighted: false },
      { text: "match", highlighted: true },
      { text: " after", highlighted: false },
    ]);
  });

  it("highlights a match at the very start", () => {
    expect(parseSnippet(`${START}match${STOP} after`)).toEqual([
      { text: "match", highlighted: true },
      { text: " after", highlighted: false },
    ]);
  });

  it("highlights a match at the very end", () => {
    expect(parseSnippet(`before ${START}match${STOP}`)).toEqual([
      { text: "before ", highlighted: false },
      { text: "match", highlighted: true },
    ]);
  });

  it("handles multiple matches, including the default fragment delimiter between them", () => {
    expect(parseSnippet(`${START}AIESEC${STOP} is ... a ${START}global${STOP} network`)).toEqual([
      { text: "AIESEC", highlighted: true },
      { text: " is ... a ", highlighted: false },
      { text: "global", highlighted: true },
      { text: " network", highlighted: false },
    ]);
  });

  it("treats an empty string as zero parts", () => {
    expect(parseSnippet("")).toEqual([]);
  });

  it("shows the remainder as plain text if a start marker is never closed", () => {
    expect(parseSnippet(`before ${START}unclosed`)).toEqual([
      { text: "before ", highlighted: false },
      { text: "unclosed", highlighted: false },
    ]);
  });
});

describe("parseSearchFilters", () => {
  it("defaults every field from an empty params object", () => {
    expect(parseSearchFilters({})).toEqual({
      query: "",
      topicIds: [],
      entityId: null,
      kind: null,
      dateFrom: null,
      dateTo: null,
      page: 1,
    });
  });

  it("trims the query", () => {
    expect(parseSearchFilters({ q: "  regional conference  " }).query).toBe("regional conference");
  });

  it("splits comma-separated topic ids and drops empty entries", () => {
    expect(parseSearchFilters({ topics: "topic_a,, topic_b ,topic_c" }).topicIds).toEqual([
      "topic_a",
      "topic_b",
      "topic_c",
    ]);
  });

  it("accepts a valid PostKind and rejects an unrecognised one", () => {
    expect(parseSearchFilters({ kind: "EVENT" }).kind).toBe("EVENT");
    expect(parseSearchFilters({ kind: "NOT_A_REAL_KIND" }).kind).toBeNull();
  });

  it("parses valid from/to dates and drops unparseable ones", () => {
    const filters = parseSearchFilters({ from: "2026-01-01", to: "not-a-date" });
    expect(filters.dateFrom).toEqual(new Date("2026-01-01"));
    expect(filters.dateTo).toBeNull();
  });

  it("clamps page to a minimum of 1 and ignores a non-numeric value", () => {
    expect(parseSearchFilters({ page: "0" }).page).toBe(1);
    expect(parseSearchFilters({ page: "-5" }).page).toBe(1);
    expect(parseSearchFilters({ page: "not-a-number" }).page).toBe(1);
    expect(parseSearchFilters({ page: "3" }).page).toBe(3);
  });

  it("takes the first value when a param arrives as an array", () => {
    expect(parseSearchFilters({ q: ["first", "second"] }).query).toBe("first");
  });

  it("treats a blank entity id the same as an absent one", () => {
    expect(parseSearchFilters({ entity: "   " }).entityId).toBeNull();
    expect(parseSearchFilters({ entity: "ent_123" }).entityId).toBe("ent_123");
  });
});
