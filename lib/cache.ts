import "server-only";

export const cacheKeys = {
  // Which classes a person holds, not what they may do — cached apart so
  // editing the matrix busts one shared key, not every member's entry.
  roleGrants: (userId: string) => `grants:${userId}`,
  permissionMatrix: () => "rbac:matrix",
  scopeSet: (userId: string) => `scope:v2:${userId}`,
  session: (jti: string) => `sess:${jti}`,
  entityTree: () => "org:tree",
  flag: (key: string) => `flag:${key}`,
  // Keyed by primaryEntityId, not userId: same-entity members share one
  // candidate window. Personal terms (affinity/seen/ack) layer on at
  // request time, never cached — this key never flattens personalization.
  feedRanked: (primaryEntityKey: string) => `feed:ranked:${primaryEntityKey}`,
};

// Process-local only: there is no distributed cache backing this. Correct for
// one dev server; on serverless, each instance holds its own entries, so a
// cache miss just costs an extra DB read rather than serving stale-forever data
// — every entry here carries a short TTL for exactly that reason.

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
  return localGet<T>(key);
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  local.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDelete(...keys: string[]): Promise<void> {
  for (const k of keys) local.delete(k);
}

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

export async function invalidateUserAuthorisation(userId: string): Promise<void> {
  await cacheDelete(cacheKeys.roleGrants(userId), cacheKeys.scopeSet(userId));
}

export function __clearLocalCache(): void {
  local.clear();
}
