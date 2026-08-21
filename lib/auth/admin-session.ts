import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

export const ADMIN_SESSION_COOKIE = "pulse_admin_session";

export const ADMIN_SESSION_ISSUER = "aiesec-pulse";
export const ADMIN_SESSION_AUDIENCE = "aiesec-pulse-admin";

const TTL_SECONDS = 12 * 60 * 60;

export type AdminClaims = { email: string; exp: number };

function secret(): Uint8Array {
  return new TextEncoder().encode(env.ADMIN_SESSION_SECRET);
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

// Digests rather than the raw strings, so the comparison is constant-time in
// the length of the input as well as in its content.
function equals(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest()
  );
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const emailMatches = equals(normaliseEmail(email), normaliseEmail(env.ADMIN_EMAIL));
  const passwordMatches = equals(password, env.ADMIN_PASSWORD);
  return emailMatches && passwordMatches;
}

export async function createAdminSession(): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(normaliseEmail(env.ADMIN_EMAIL))
    .setIssuedAt()
    .setIssuer(ADMIN_SESSION_ISSUER)
    .setAudience(ADMIN_SESSION_AUDIENCE)
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());

  return { token, expiresAt };
}

export async function verifyAdminSessionToken(token: string): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ADMIN_SESSION_ISSUER,
      audience: ADMIN_SESSION_AUDIENCE,
      algorithms: ["HS256"],
    });
    // Rotating ADMIN_EMAIL invalidates every token minted for the old address.
    if (typeof payload.sub !== "string" || payload.sub !== normaliseEmail(env.ADMIN_EMAIL)) {
      return null;
    }
    return { email: payload.sub, exp: payload.exp ?? 0 };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminClaims | null> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
};

export async function setAdminSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, {
    ...COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, "", {
    ...COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}
