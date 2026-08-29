import { beforeEach, describe, expect, it, vi } from "vitest";

import { __clearLocalCache } from "@/lib/cache";
import { isEnabled } from "@/lib/flags";

vi.mock("@/lib/db", () => ({
  db: { featureFlag: { findUnique: vi.fn() } },
}));

import { db } from "@/lib/db";

const findUnique = vi.mocked(db.featureFlag.findUnique);

describe("isEnabled", () => {
  beforeEach(() => {
    __clearLocalCache();
    findUnique.mockReset();
  });

  it("returns the stored value when the flag exists", async () => {
    findUnique.mockResolvedValue({ enabled: true } as never);
    expect(await isEnabled("posts.drafts")).toBe(true);
  });

  it("defaults to false when the flag row is missing", async () => {
    findUnique.mockResolvedValue(null);
    expect(await isEnabled("posts.rich_text")).toBe(false);
  });

  it("fails closed when the DB read throws", async () => {
    findUnique.mockRejectedValue(new Error("connection reset"));
    expect(await isEnabled("feed.ranked")).toBe(false);
  });

  it("caches the result, so a second read within the TTL skips the DB", async () => {
    findUnique.mockResolvedValue({ enabled: true } as never);
    await isEnabled("search.enabled");
    await isEnabled("search.enabled");
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
