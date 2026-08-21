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
