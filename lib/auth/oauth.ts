import "server-only";

import { cookies } from "next/headers";

import { pkceChallenge, randomToken, safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";

// `state` is unconditional — without it the callback accepts any code
// (login-CSRF). PKCE is opt-in behind AIESEC_OAUTH_PKCE_S256 since codes
// are single-use: a rejected challenge would break login with no retry.

const STATE_COOKIE = "pulse_oauth_state";
const VERIFIER_COOKIE = "pulse_oauth_verifier";
const RETURN_TO_COOKIE = "pulse_oauth_return_to";

const HANDSHAKE_TTL_SECONDS = 10 * 60;

function pkceEnabled(): boolean {
  return process.env.AIESEC_OAUTH_PKCE_S256 === "true";
}

const handshakeCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Lax, not Strict: the callback is a cross-site navigation that Strict
  // would break.
  sameSite: "lax" as const,
  path: "/",
  maxAge: HANDSHAKE_TTL_SECONDS,
});

export type Handshake = { state: string; codeVerifier: string | null };

export async function beginHandshake(returnTo: string): Promise<Handshake> {
  const state = randomToken(32);
  const codeVerifier = pkceEnabled() ? randomToken(48) : null;

  const store = await cookies();
  store.set(STATE_COOKIE, state, handshakeCookieOptions());
  store.set(RETURN_TO_COOKIE, returnTo, handshakeCookieOptions());
  if (codeVerifier) store.set(VERIFIER_COOKIE, codeVerifier, handshakeCookieOptions());

  return { state, codeVerifier };
}

export type HandshakeResult =
  | { ok: true; codeVerifier: string | null; returnTo: string }
  | { ok: false; reason: "missing_state" | "state_mismatch" };

// Cleared regardless of outcome: a handshake is single-use, and a leftover
// `state` could be replayed against an attacker-supplied code.
export async function completeHandshake(returnedState: string | null): Promise<HandshakeResult> {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value ?? null;
  const codeVerifier = store.get(VERIFIER_COOKIE)?.value ?? null;
  const returnTo = store.get(RETURN_TO_COOKIE)?.value ?? "/feed";

  await clearHandshake();

  if (!expected || !returnedState) return { ok: false, reason: "missing_state" };
  if (!safeEqual(expected, returnedState)) return { ok: false, reason: "state_mismatch" };

  return { ok: true, codeVerifier, returnTo: safeReturnTo(returnTo) };
}

async function clearHandshake(): Promise<void> {
  const store = await cookies();
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, RETURN_TO_COOKIE]) {
    store.set(name, "", { ...handshakeCookieOptions(), maxAge: 0 });
  }
}

// `//evil.example` is protocol-relative — browsers treat it as absolute,
// the usual open-redirect bypass.
export function safeReturnTo(candidate: string | null | undefined): string {
  if (!candidate) return "/feed";
  if (!candidate.startsWith("/")) return "/feed";
  if (candidate.startsWith("//")) return "/feed";
  if (candidate.startsWith("/\\")) return "/feed";
  if (candidate.startsWith("/api/auth")) return "/feed";
  return candidate;
}

export function authorizeUrl(handshake: Handshake): string {
  const base = env.AIESEC_OAUTH_AUTH_URL.replace(/\/$/, "");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.AIESEC_OAUTH_CLIENT_ID,
    redirect_uri: env.AIESEC_OAUTH_REDIRECT_URI,
    state: handshake.state,
  });

  if (handshake.codeVerifier) {
    params.set("code_challenge", pkceChallenge(handshake.codeVerifier));
    params.set("code_challenge_method", "S256");
  }

  return `${base}/authorize?${params.toString()}`;
}
