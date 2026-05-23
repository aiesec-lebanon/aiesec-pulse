import { describe, it, expect } from "vitest";
import { currentIsoWeek } from "../lib/week";

describe("currentIsoWeek", () => {
  it("Jan 1 2024 (Monday) → 2024-W01", () => {
    expect(currentIsoWeek(new Date("2024-01-01T00:00:00Z"))).toBe("2024-W01");
  });

  it("Dec 30 2024 (Monday) → 2025-W01 (ISO week year is 2025)", () => {
    expect(currentIsoWeek(new Date("2024-12-30T00:00:00Z"))).toBe("2025-W01");
  });

  it("Jan 1 2027 (Friday) → 2026-W53", () => {
    expect(currentIsoWeek(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
  });

  it("Aug 15 2026 → 2026-W33", () => {
    expect(currentIsoWeek(new Date("2026-08-15T00:00:00Z"))).toBe("2026-W33");
  });
});
