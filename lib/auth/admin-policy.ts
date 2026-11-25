// Shared by proxy.ts (no database, no server-only imports) and admin-session.ts.

import { COOKIE_NAMES } from "@/lib/cookie-policy";

export const ADMIN_SESSION_COOKIE = COOKIE_NAMES.adminSession;
export const ADMIN_SESSION_ISSUER = "aiesec-pulse";
export const ADMIN_SESSION_AUDIENCE = "aiesec-pulse-admin";

/** Sliding: every admin request pushes expiry this far out, up to the hard cap. */
export const ADMIN_IDLE_SECONDS = 30 * 60;
/** Hard cap from sign-in, however active the session is. */
export const ADMIN_MAX_SECONDS = 12 * 60 * 60;
/** Re-issue the cookie at most this often, so every click is not a cookie write. */
export const ADMIN_REFRESH_AFTER_SECONDS = 60;

export const ADMIN_MIN_PASSWORD_LENGTH = 16;

export function adminTokenExpiry(signedInAt: number, now: number): number {
  return Math.min(now + ADMIN_IDLE_SECONDS, signedInAt + ADMIN_MAX_SECONDS);
}
