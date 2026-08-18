import { afterEach, describe, expect, it, vi } from "vitest";

import { PostStatus } from "@/app/generated/prisma/enums";
import { dueScheduledPostsQuery } from "@/jobs/schedule";
import { formatAsWallTime, zonedWallTimeToUtc } from "@/lib/timezone";

describe("dueScheduledPostsQuery", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects SCHEDULED posts due at or before the given instant", () => {
    const now = new Date("2026-08-20T09:00:00Z");
    const query = dueScheduledPostsQuery(now);

    expect(query.where).toEqual({ status: PostStatus.SCHEDULED, scheduledAt: { lte: now } });
    expect(query.orderBy).toEqual({ scheduledAt: "asc" });
  });

  it("defaults to the current instant, under a fake clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T09:00:00Z"));

    const query = dueScheduledPostsQuery();

    expect(query.where.scheduledAt).toEqual({ lte: new Date("2026-08-20T09:00:00Z") });
  });

  it("moves the boundary forward as the fake clock advances", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T09:00:00Z"));
    vi.advanceTimersByTime(90_000); // 1.5 minutes

    const query = dueScheduledPostsQuery();

    expect(query.where.scheduledAt).toEqual({ lte: new Date("2026-08-20T09:01:30Z") });
  });
});

describe("zonedWallTimeToUtc", () => {
  it("treats a UTC timezone as a straight passthrough", () => {
    expect(zonedWallTimeToUtc("2026-08-20T09:00", "UTC").toISOString()).toBe(
      "2026-08-20T09:00:00.000Z"
    );
  });

  it("interprets the wall-clock value in the given zone, not the host's own", () => {
    // Beirut is UTC+3 in August (no DST ambiguity at this date) — 09:00
    // Beirut wall-clock is 06:00 UTC.
    expect(zonedWallTimeToUtc("2026-08-20T09:00", "Asia/Beirut").toISOString()).toBe(
      "2026-08-20T06:00:00.000Z"
    );
  });

  it("handles a zone west of UTC", () => {
    // America/New_York is UTC-4 under EDT in August.
    expect(zonedWallTimeToUtc("2026-08-20T09:00", "America/New_York").toISOString()).toBe(
      "2026-08-20T13:00:00.000Z"
    );
  });

  it("round-trips with formatAsWallTime", () => {
    const utc = zonedWallTimeToUtc("2026-08-20T09:00", "Asia/Beirut");
    expect(formatAsWallTime(utc, "Asia/Beirut")).toBe("2026-08-20T09:00");
  });
});
