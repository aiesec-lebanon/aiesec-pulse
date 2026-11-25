import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";

import {
  ADMIN_MAX_SECONDS,
  ADMIN_SESSION_AUDIENCE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_ISSUER,
  adminTokenExpiry,
} from "@/lib/auth/admin-policy";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export { ADMIN_SESSION_AUDIENCE, ADMIN_SESSION_COOKIE, ADMIN_SESSION_ISSUER };

/** Audit target type for an admin session; its id is the session id (or ALL). */
export const ADMIN_SESSION_TARGET = "admin_session";
/** Target id of a "sign out every admin session" record. */
export const ALL_ADMIN_SESSIONS = "*";

export type AdminClaims = { email: string; sessionId: string; signedInAt: number; exp: number };

function secret(): Uint8Array {
  return new TextEncoder().encode(env.ADMIN_SESSION_SECRET);
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

// Hash first so the comparison is constant-time regardless of input length.
function equals(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest()
  );
}

// Bound into every token, so rotating ADMIN_PASSWORD (or ADMIN_EMAIL) signs
// every open admin session out at once — the handover duty, enforced.
function credentialFingerprint(): string {
  return createHmac("sha256", env.ADMIN_SESSION_SECRET)
    .update(`${normaliseEmail(env.ADMIN_EMAIL)}\n${env.ADMIN_PASSWORD}`)
    .digest("base64url")
    .slice(0, 22);
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const emailMatches = equals(normaliseEmail(email), normaliseEmail(env.ADMIN_EMAIL));
  const passwordMatches = equals(password, env.ADMIN_PASSWORD);
  return emailMatches && passwordMatches;
}

export async function createAdminSession(): Promise<{
  token: string;
  sessionId: string;
  cookieMaxAge: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const sessionId = randomUUID();
  const token = await new SignJWT({ sat: now, cfp: credentialFingerprint() })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(normaliseEmail(env.ADMIN_EMAIL))
    .setJti(sessionId)
    .setIssuedAt(now)
    .setIssuer(ADMIN_SESSION_ISSUER)
    .setAudience(ADMIN_SESSION_AUDIENCE)
    .setExpirationTime(adminTokenExpiry(now, now))
    .sign(secret());

  return { token, sessionId, cookieMaxAge: ADMIN_MAX_SECONDS };
}

async function verifyAdminSessionToken(token: string): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ADMIN_SESSION_ISSUER,
      audience: ADMIN_SESSION_AUDIENCE,
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || payload.sub !== normaliseEmail(env.ADMIN_EMAIL)) {
      return null;
    }
    if (typeof payload.jti !== "string" || typeof payload.sat !== "number") return null;
    if (typeof payload.cfp !== "string" || !equals(payload.cfp, credentialFingerprint())) {
      return null;
    }
    if (Date.now() / 1000 >= payload.sat + ADMIN_MAX_SECONDS) return null;

    return {
      email: payload.sub,
      sessionId: payload.jti,
      signedInAt: payload.sat,
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
}

// Revocation is read from the audit log: signing out records the session id,
// and "sign out everywhere" records a cut-off. Both are facts, so nothing is
// updated, and the check holds across every server instance.
async function isRevoked(claims: AdminClaims): Promise<boolean> {
  const revoked = await db.auditEvent.findFirst({
    where: {
      targetType: ADMIN_SESSION_TARGET,
      OR: [
        { targetId: claims.sessionId, action: "admin.signed_out" },
        {
          targetId: ALL_ADMIN_SESSIONS,
          createdAt: { gte: new Date(claims.signedInAt * 1000) },
        },
      ],
    },
    select: { id: true },
  });
  return revoked !== null;
}

export const getAdminSession = cache(async (): Promise<AdminClaims | null> => {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifyAdminSessionToken(token);
  if (!claims) return null;
  if (await isRevoked(claims)) return null;
  return claims;
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
};

export function adminCookieOptions(maxAgeSeconds: number) {
  return {
    ...COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}

export async function setAdminSessionCookie(token: string, maxAgeSeconds: number): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, adminCookieOptions(maxAgeSeconds));
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete({ name: ADMIN_SESSION_COOKIE, path: "/" });
}
