// The one list of what Pulse stores in the browser. The code takes its cookie
// and storage names from here and /legal/cookies renders its tables from it,
// so the policy cannot drift from what is actually set.

/** Shown on /legal/cookies. Bump with COOKIE_POLICY_VERSION when anything below changes. */
export const COOKIE_POLICY_UPDATED = "25 November 2026";
/** A stored choice for an older version re-shows the banner. */
export const COOKIE_POLICY_VERSION = "2026-11-25";

export const COOKIE_NAMES = {
  session: "pulse_session",
  adminSession: "pulse_admin_session",
  oauthState: "pulse_oauth_state",
  oauthVerifier: "pulse_oauth_verifier",
  oauthReturnTo: "pulse_oauth_return_to",
  feedMode: "pulse_feed_mode",
  consent: "ail_cookie_consent",
} as const;

export const STORAGE_KEYS = {
  theme: "theme",
  motion: "pulse-motion",
} as const;

/** Six months, after which the banner asks again (AIESEC cookie banner rules). */
export const CONSENT_MAX_AGE_SECONDS = 15_552_000;

export type StorageItem = { name: string; purpose: string; lifetime: string };

export const COOKIES: StorageItem[] = [
  {
    name: COOKIE_NAMES.session,
    purpose:
      "Keeps you signed in. Contains a signed reference to your session record — no personal data and no AIESEC credentials.",
    lifetime: "Until you sign out; ends after 7 days without use, and always after 30 days",
  },
  {
    name: COOKIE_NAMES.oauthState,
    purpose:
      "Ties your sign-in attempt to your browser, so an attacker cannot complete a sign-in on your behalf.",
    lifetime: "10 minutes",
  },
  {
    name: COOKIE_NAMES.oauthVerifier,
    purpose: "Additional sign-in protection, when the AIESEC authorisation server supports it.",
    lifetime: "10 minutes",
  },
  {
    name: COOKIE_NAMES.oauthReturnTo,
    purpose: "Remembers the page you were heading to before signing in.",
    lifetime: "10 minutes",
  },
  {
    name: COOKIE_NAMES.feedMode,
    purpose:
      "Remembers whether you chose Latest or For You on the feed. Set only when you switch views.",
    lifetime: "1 year",
  },
  {
    name: COOKIE_NAMES.adminSession,
    purpose:
      "Keeps the platform administrator signed in to the administration console. Never set for members.",
    lifetime: "Ends after 30 minutes without use, and always 12 hours after signing in",
  },
  {
    name: COOKIE_NAMES.consent,
    purpose:
      "Remembers your cookie choice and the version of this policy it was made for. Readable by the page, because the banner needs it.",
    lifetime: "6 months",
  },
];

export const BROWSER_STORAGE: StorageItem[] = [
  {
    name: STORAGE_KEYS.theme,
    purpose:
      "Remembers whether you chose light or dark, so the page does not flash the wrong one while loading. Set only if you pick one; otherwise Pulse follows your device.",
    lifetime: "Until you clear your browser storage",
  },
  {
    name: STORAGE_KEYS.motion,
    purpose:
      "Remembers whether you chose full or reduced motion. Set only if you pick one; otherwise Pulse follows your device.",
    lifetime: "Until you clear your browser storage",
  },
];
