import "server-only";

import { Ratelimit } from "@upstash/ratelimit";

import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

// A module-level Map is ineffective on serverless: each instance holds its own
// buckets, so the real limit is max x instance count. The in-memory limiter
// below is a local-development fallback only.

export type LimitName =
  | "auth"
  | "postSubmit"
  | "promote"
  | "draftAutosave"
  | "comment"
  | "report"
  | "upload"
  | "readBeacon";

const LIMITS: Record<LimitName, { max: number; windowSeconds: number; by: "ip" | "user" }> = {
  auth: { max: 10, windowSeconds: 15 * 60, by: "ip" },
  postSubmit: { max: 5, windowSeconds: 60, by: "user" },
  // Its own bucket rather than postSubmit's: an officer who has just published
  // should not find promoting throttled, and each promotion costs a live GIS
  // round trip (architecture.md §6.3) that is worth capping on its own. Far
  // above the weekly promotion quota, so this only ever catches hammering.
  promote: { max: 10, windowSeconds: 60 * 60, by: "user" },
  // The composer autosaves on a 5-second debounce (architecture.md §8.1), so
  // postSubmit's 5/minute budget would be exhausted by normal typing. Headroom
  // above the ~12 ticks/minute the debounce can produce, not a bare minimum.
  draftAutosave: { max: 20, windowSeconds: 60, by: "user" },
  comment: { max: 10, windowSeconds: 60, by: "user" },
  report: { max: 20, windowSeconds: 60 * 60, by: "user" },
  upload: { max: 20, windowSeconds: 60 * 60, by: "user" },
  readBeacon: { max: 60, windowSeconds: 60, by: "user" },
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const limiters = new Map<LimitName, Ratelimit>();

function limiter(name: LimitName): Ratelimit | null {
  const client = redis();
  if (!client) return null;

  const existing = limiters.get(name);
  if (existing) return existing;

  const { max, windowSeconds } = LIMITS[name];
  const built = new Ratelimit({
    redis: client,
    // A fixed window lets a caller spend two budgets across the reset boundary.
    limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
    prefix: `rl:${name}`,
    analytics: false,
  });
  limiters.set(name, built);
  return built;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

function localCheck(name: LimitName, key: string): RateLimitResult {
  const { max, windowSeconds } = LIMITS[name];
  const now = Date.now();
  const bucketKey = `${name}:${key}`;
  let bucket = buckets.get(bucketKey);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowSeconds * 1000 };
    buckets.set(bucketKey, bucket);
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
    resetAt: bucket.resetAt,
  };
}

// Fails open on a Redis error, except auth: a limiter outage should degrade
// throttling, not sign everyone out, but an unbounded window in front of the
// only door into the platform is worse than a brief lockout.
export async function checkRateLimit(
  name: LimitName,
  identifier: string
): Promise<RateLimitResult> {
  const rl = limiter(name);
  if (!rl) return localCheck(name, identifier);

  try {
    const { success, remaining, reset } = await rl.limit(identifier);
    return { allowed: success, remaining, resetAt: reset };
  } catch (error) {
    const failClosed = name === "auth";
    logger.error("Rate limiter unavailable", { limit: name, failClosed, error });
    return failClosed
      ? { allowed: false, remaining: 0, resetAt: Date.now() + LIMITS[name].windowSeconds * 1000 }
      : { allowed: true, remaining: 0, resetAt: Date.now() };
  }
}

export function retryMessage(result: RateLimitResult): string {
  const seconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  if (seconds < 60) return `Too many requests. Try again in ${seconds} seconds.`;
  const minutes = Math.ceil(seconds / 60);
  return `Too many requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export const __testing = { LIMITS, clear: () => buckets.clear() };
