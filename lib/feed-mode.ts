// Lives outside app/actions/feed-preferences.ts: a "use server" module may
// only export async functions, so a runtime constant can't live there.

export type FeedMode = "latest" | "for-you";

export const FEED_MODE_COOKIE = "pulse_feed_mode";

// "For You" is the default once ranking is available: the feed is
// personalised by default, with Latest as the explicit escape hatch.
const DEFAULT_FEED_MODE: FeedMode = "for-you";

export function parseFeedMode(value: string | undefined): FeedMode {
  return value === "latest" ? "latest" : DEFAULT_FEED_MODE;
}
