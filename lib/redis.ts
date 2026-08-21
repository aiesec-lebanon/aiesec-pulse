import "server-only";

import { Redis } from "@upstash/redis";

import { has } from "@/lib/env";
import { logger } from "@/lib/logger";

// Without Redis this degrades to a process-local Map — correct for one dev
// server, wrong across serverless instances — so the fallback warns once.

let client: Redis | null = null;
let warned = false;

export function redis(): Redis | null {
  if (client) return client;
  if (!has.redis()) {
    if (!warned) {
      warned = true;
      logger.warn("Redis is not configured — caching and rate limiting are process-local", {
        impact: "Correct for a single dev server; ineffective across serverless instances.",
      });
    }
    return null;
  }
  client = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return client;
}

type LocalEntry = { value: unknown; expiresAt: number };
const local = new Map<string, LocalEntry>();

function localGet<T>(key: string): T | null {
  const hit = local.get(key);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    local.delete(key);
    return null;
  }
  return hit.value as T;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = redis();
  if (!r) return localGet<T>(key);
  try {
    return (await r.get<T>(key)) ?? null;
  } catch (error) {
    // A cache outage must never take a read path down.
    logger.warn("Redis read failed; serving uncached", { key, error });
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const r = redis();
  if (!r) {
    local.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return;
  }
  try {
    await r.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    logger.warn("Redis write failed", { key, error });
  }
}

export async function cacheDelete(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const r = redis();
  if (!r) {
    for (const k of keys) local.delete(k);
    return;
  }
  try {
    await r.del(...keys);
  } catch (error) {
    logger.warn("Redis delete failed", { keys, error });
  }
}

// Errors from the cache layer are swallowed; errors from `loader` are not.
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await loader();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

export const cacheKeys = {
  // Which classes a person holds and where — not what those classes may do.
  // The two are cached apart so that editing the permission matrix busts one
  // shared key instead of every member's entry (lib/rbac/matrix.ts).
  roleGrants: (userId: string) => `grants:${userId}`,
  permissionMatrix: () => "rbac:matrix",
  scopeSet: (userId: string) => `scope:${userId}`,
  session: (jti: string) => `sess:${jti}`,
  entityTree: () => "org:tree",
  flag: (key: string) => `flag:${key}`,
  // Keyed by primaryEntityId, not userId: architecture.md §11/§17 — every
  // member of the same entity shares the same bounded candidate window.
  // Personal terms (affinity, seen, ack) are layered on at request time,
  // never cached, so personalisation itself is never flattened by this key.
  feedRanked: (primaryEntityKey: string) => `feed:ranked:${primaryEntityKey}`,
};

export async function invalidateUserAuthorisation(userId: string): Promise<void> {
  await cacheDelete(cacheKeys.roleGrants(userId), cacheKeys.scopeSet(userId));
}

export function __clearLocalCache(): void {
  local.clear();
}
