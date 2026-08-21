/**
 * The Redis key vocabulary, kept apart from `lib/redis.ts` because that module
 * is `server-only` and this one is not: the e2e teardown runs in the Playwright
 * process, outside React, and must invalidate exactly the keys the application
 * writes. Duplicating the formats there would let the two drift silently — the
 * teardown would go on "succeeding" while leaving stale entries behind.
 *
 * Re-exported from `lib/redis.ts`, so application code keeps importing it from
 * there and nothing about the server-side call sites changes.
 */
export const cacheKeys = {
  // Which classes a person holds and where — not what those classes may do.
  // The two are cached apart so that editing the permission matrix busts one
  // shared key instead of every member's entry (lib/rbac/matrix.ts).
  roleGrants: (userId: string) => `grants:${userId}`,
  permissionMatrix: () => "rbac:matrix",
  // Versioned: a scope set moved from the viewer's ancestor chain to
  // their MC subtree, so an entry written by the previous deployment answers a
  // different question rather than merely being stale.
  scopeSet: (userId: string) => `scope:v2:${userId}`,
  session: (jti: string) => `sess:${jti}`,
  entityTree: () => "org:tree",
  flag: (key: string) => `flag:${key}`,
  // Keyed by primaryEntityId, not userId: every member of the same entity
  // shares the same bounded candidate window.
  // Personal terms (affinity, seen, ack) are layered on at request time,
  // never cached, so personalisation itself is never flattened by this key.
  feedRanked: (primaryEntityKey: string) => `feed:ranked:${primaryEntityKey}`,
};
