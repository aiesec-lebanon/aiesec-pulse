/**
 * The Redis key vocabulary, kept apart from `lib/redis.ts` (which is
 * `server-only`, unlike this file) because the e2e teardown runs in the
 * Playwright process, outside React, and must invalidate exactly the keys
 * the application writes. Duplicating the formats there would let the two
 * drift silently — the teardown would keep "succeeding" while leaving stale
 * entries behind.
 *
 * Re-exported from `lib/redis.ts` for server-side call sites.
 */
export const cacheKeys = {
  // Which classes a person holds and where — not what those classes may do.
  // Cached apart so editing the permission matrix busts one shared key, not
  // every member's entry (lib/rbac/matrix.ts).
  roleGrants: (userId: string) => `grants:${userId}`,
  permissionMatrix: () => "rbac:matrix",
  // Versioned: a scope set moved from the viewer's ancestor chain to their
  // MC subtree, so an entry from the previous deployment answers a different
  // question, not merely a stale one.
  scopeSet: (userId: string) => `scope:v2:${userId}`,
  session: (jti: string) => `sess:${jti}`,
  entityTree: () => "org:tree",
  flag: (key: string) => `flag:${key}`,
  // Keyed by primaryEntityId, not userId: every member of the same entity
  // shares the same bounded candidate window. Personal terms (affinity,
  // seen, ack) are layered on at request time, never cached, so this key
  // never flattens personalisation itself.
  feedRanked: (primaryEntityKey: string) => `feed:ranked:${primaryEntityKey}`,
};
