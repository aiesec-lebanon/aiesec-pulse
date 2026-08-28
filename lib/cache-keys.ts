/**
 * Redis key vocabulary, kept apart from `lib/redis.ts` (server-only) so the
 * e2e teardown (outside React) can invalidate the exact keys the app writes
 * without duplicating formats and drifting silently out of sync.
 *
 * Re-exported from `lib/redis.ts` for server-side call sites.
 */
export const cacheKeys = {
  // Which classes a person holds, not what they may do — cached apart so
  // editing the matrix busts one shared key, not every member's entry.
  roleGrants: (userId: string) => `grants:${userId}`,
  permissionMatrix: () => "rbac:matrix",
  // Versioned: scope semantics changed (ancestor chain -> MC subtree), so
  // an old entry would answer a different question, not just a stale one.
  scopeSet: (userId: string) => `scope:v2:${userId}`,
  session: (jti: string) => `sess:${jti}`,
  entityTree: () => "org:tree",
  flag: (key: string) => `flag:${key}`,
  // Keyed by primaryEntityId, not userId: same-entity members share one
  // candidate window. Personal terms (affinity/seen/ack) layer on at
  // request time, never cached — this key never flattens personalisation.
  feedRanked: (primaryEntityKey: string) => `feed:ranked:${primaryEntityKey}`,
};
