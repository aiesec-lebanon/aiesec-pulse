import "server-only";

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
  // Own bucket, not postSubmit's — publishing shouldn't throttle promoting,
  // and each promotion costs a live GIS round trip worth capping. Far above
  // the weekly quota; this only catches hammering.
  promote: { max: 10, windowSeconds: 60 * 60, by: "user" },
  // Composer autosaves on a 5s debounce (~12 ticks/min); postSubmit's 5/min
  // budget would exhaust from normal typing, so this has headroom instead.
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

export async function checkRateLimit(
  name: LimitName,
  identifier: string
): Promise<RateLimitResult> {
  return localCheck(name, identifier);
}

export function retryMessage(result: RateLimitResult): string {
  const seconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  if (seconds < 60) return `Too many requests. Try again in ${seconds} seconds.`;
  const minutes = Math.ceil(seconds / 60);
  return `Too many requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export const __testing = { LIMITS, clear: () => buckets.clear() };
