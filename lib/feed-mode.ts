// Cookie name/type live outside app/actions/feed-preferences.ts deliberately:
// a "use server" module may only export async functions (React Server
// Functions), so a runtime constant like FEED_MODE_COOKIE can't live there —
// same reason SESSION_COOKIE lives in lib/auth/session.ts rather than inside
// an action file.

export type FeedMode = "latest" | "for-you";

export const FEED_MODE_COOKIE = "pulse_feed_mode";

// "For You" is the default once ranking is available — context.md §10's
// Phase 1 exit criterion is a feed "demonstrably personalised" by default,
// with Latest as the explicit escape hatch, not the other way round.
export const DEFAULT_FEED_MODE: FeedMode = "for-you";

export function parseFeedMode(value: string | undefined): FeedMode {
  return value === "latest" ? "latest" : DEFAULT_FEED_MODE;
}
