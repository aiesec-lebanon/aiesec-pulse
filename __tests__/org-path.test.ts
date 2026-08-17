import { describe, expect, it } from "vitest";

import { kindForDepth } from "@/lib/org/entities";
import {
  ancestorPaths,
  depthOf,
  isAncestorPath,
  isInSubtree,
  joinPath,
  pathSegment,
  proximity,
} from "@/lib/org/path";

describe("pathSegment", () => {
  it("lowercases and hyphenates", () => {
    expect(pathSegment("AIESEC in Lebanon")).toBe("aiesec-in-lebanon");
  });

  it("strips diacritics so equivalent names agree", () => {
    expect(pathSegment("Côte d'Ivoire")).toBe("cote-d-ivoire");
    expect(pathSegment("İstanbul")).toBe(pathSegment("Istanbul"));
  });

  it("never emits a slash, which would break prefix matching", () => {
    expect(pathSegment("AI/MENA")).toBe("ai-mena");
    expect(pathSegment("a/b/c")).not.toContain("/");
  });

  it("falls back rather than producing an empty segment", () => {
    expect(pathSegment("!!!")).toBe("entity");
    expect(pathSegment("")).toBe("entity");
  });

  it("trims to a bounded length without leaving a trailing hyphen", () => {
    const segment = pathSegment("a".repeat(80));
    expect(segment.length).toBeLessThanOrEqual(40);
    expect(segment.endsWith("-")).toBe(false);
  });
});

describe("joinPath and depth", () => {
  it("builds a root-anchored path", () => {
    expect(joinPath("/ai", "mena")).toBe("/ai/mena");
    expect(joinPath("/ai/mena", "lb")).toBe("/ai/mena/lb");
  });

  it("counts tiers", () => {
    expect(depthOf("/ai")).toBe(1);
    expect(depthOf("/ai/mena")).toBe(2);
    expect(depthOf("/ai/mena/lb")).toBe(3);
    expect(depthOf("/ai/mena/lb/aub")).toBe(4);
  });

  it("maps depth to the AIESEC tier", () => {
    expect(kindForDepth(1)).toBe("GLOBAL");
    expect(kindForDepth(2)).toBe("REGION");
    expect(kindForDepth(3)).toBe("MC");
    expect(kindForDepth(4)).toBe("LC");
    expect(kindForDepth(5)).toBe("LC");
  });
});

describe("subtree containment", () => {
  it("recognises real ancestry", () => {
    expect(isAncestorPath("/ai", "/ai/mena")).toBe(true);
    expect(isAncestorPath("/ai/mena", "/ai/mena/lb/aub")).toBe(true);
  });

  it("does not treat a partial segment as an ancestor", () => {
    // The bug this guards: `/ai/me`.startsWith is true for `/ai/mena`.
    expect(isAncestorPath("/ai/me", "/ai/mena")).toBe(false);
    expect(isAncestorPath("/ai/mena", "/ai/menagerie")).toBe(false);
  });

  it("is strict — a path is not its own ancestor", () => {
    expect(isAncestorPath("/ai/mena", "/ai/mena")).toBe(false);
  });

  it("includes the scope itself in its own subtree", () => {
    expect(isInSubtree("/ai/mena/lb", "/ai/mena/lb")).toBe(true);
    expect(isInSubtree("/ai/mena/lb", "/ai/mena/lb/aub")).toBe(true);
    expect(isInSubtree("/ai/mena/lb", "/ai/mena/jo")).toBe(false);
  });

  it("keeps an entity grant from covering a sibling", () => {
    // A publisher scoped to Lebanon must not reach Jordan.
    expect(isInSubtree("/ai/mena/lb", "/ai/mena/jo/uj")).toBe(false);
  });
});

describe("ancestorPaths", () => {
  it("lists every ancestor, root first, excluding the path itself", () => {
    expect(ancestorPaths("/ai/mena/lb/aub")).toEqual(["/ai", "/ai/mena", "/ai/mena/lb"]);
  });

  it("returns nothing for the root", () => {
    expect(ancestorPaths("/ai")).toEqual([]);
  });
});

describe("proximity", () => {
  it("scores the documented tiers", () => {
    expect(proximity("/ai/mena/lb/aub", "/ai/mena/lb/aub")).toBe(1.0);
    expect(proximity("/ai/mena/lb/aub", "/ai/mena/lb/lau")).toBe(0.8);
    expect(proximity("/ai/mena/lb/aub", "/ai/mena/jo/uj")).toBe(0.5);
    expect(proximity("/ai/mena/lb/aub", "/ai/europe/de/ber")).toBe(0.3);
  });

  it("is symmetric", () => {
    expect(proximity("/ai/mena/lb", "/ai/europe/de")).toBe(
      proximity("/ai/europe/de", "/ai/mena/lb")
    );
  });

  it("degrades to the global score when a path is missing", () => {
    expect(proximity("", "/ai/mena")).toBe(0.3);
  });
});
