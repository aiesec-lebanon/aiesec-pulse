import "server-only";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { cached, cacheDelete, cacheKeys } from "@/lib/redis";

// Mirrors prisma/seed.ts, the source of truth for which keys exist.
export const FLAG_KEYS = [
  "feed.ranked",
  "posts.drafts",
  "posts.scheduling",
  "posts.rich_text",
  "posts.targeting",
  "search.enabled",
  "notifications.centre",
  "notifications.digest",
  "notifications.push",
  "moderation.reports",
  "analytics.post_insights",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

// Short TTL because a flag flip from /admin/flags must reach every instance
// within seconds, not the minutes a permission/scope cache can tolerate.
const TTL_SECONDS = 15;

// A cache or DB outage must not silently turn a flag on — every gated feature
// is opt-in, so "unknown" and "off" are the same outcome.
export async function isEnabled(key: FlagKey): Promise<boolean> {
  try {
    return await cached(cacheKeys.flag(key), TTL_SECONDS, async () => {
      const row = await db.featureFlag.findUnique({ where: { key }, select: { enabled: true } });
      return row?.enabled ?? false;
    });
  } catch (error) {
    logger.warn("Feature flag read failed; failing closed", { key, error });
    return false;
  }
}

export async function invalidateFlag(key: FlagKey): Promise<void> {
  await cacheDelete(cacheKeys.flag(key));
}
