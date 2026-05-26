type Bucket = { count: number; resetAt: number };

function makeRateLimiter(windowMs: number, max: number) {
  const buckets = new Map<string, Bucket>();
  return function check(key: string): boolean {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count++;
    return b.count <= max;
  };
}

// Admin login: 5 attempts per 15 minutes
export const checkRateLimit = makeRateLimiter(15 * 60 * 1000, 5);

// Post creation: 5 attempts per minute
export const checkPostRateLimit = makeRateLimiter(60 * 1000, 5);
