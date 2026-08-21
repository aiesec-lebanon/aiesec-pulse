import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import { hashIp } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { cacheDelete, cacheGet, cacheKeys, cacheSet } from "@/lib/redis";

export const SESSION_COOKIE = "pulse_session";

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

const REVOCATION_TTL_SECONDS = 60;

export type SessionClaims = { sub: string; jti: string; iat: number; exp: number };

function secret(): Uint8Array {
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null }
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const session = await db.session.create({
    data: {
      userId,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      ipHash: hashIp(meta.ip),
      expiresAt,
    },
    select: { id: true },
  });

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setJti(session.id)
    .setIssuedAt()
    .setIssuer("aiesec-pulse")
    .setAudience("aiesec-pulse")
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());

  return { token, sessionId: session.id, expiresAt };
}

/** Signature and expiry only. Never the only check — it cannot see revocation. */
async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "aiesec-pulse",
      audience: "aiesec-pulse",
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.jti !== "string") return null;
    return {
      sub: payload.sub,
      jti: payload.jti,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
}

type SessionState = { userId: string; expiresAtMs: number; revoked: boolean };

async function sessionState(jti: string): Promise<SessionState | null> {
  const key = cacheKeys.session(jti);
  const hit = await cacheGet<SessionState>(key);
  if (hit) return hit;

  const row = await db.session.findUnique({
    where: { id: jti },
    select: { userId: true, expiresAt: true, revokedAt: true },
  });
  if (!row) return null;

  const state: SessionState = {
    userId: row.userId,
    expiresAtMs: row.expiresAt.getTime(),
    revoked: row.revokedAt !== null,
  };
  await cacheSet(key, state, REVOCATION_TTL_SECONDS);
  return state;
}

export type ActiveSession = { userId: string; sessionId: string; expiresAt: Date };

export async function getActiveSession(): Promise<ActiveSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const state = await sessionState(claims.jti);
  if (!state || state.revoked) return null;
  if (Date.now() >= state.expiresAtMs) return null;
  if (state.userId !== claims.sub) {
    logger.error("Session token subject does not match the stored session", {
      sessionId: claims.jti,
    });
    return null;
  }

  return {
    userId: state.userId,
    sessionId: claims.jti,
    expiresAt: new Date(state.expiresAtMs),
  };
}

/** Fire-and-forget at the call site: presence tracking must never fail a render. */
export async function touchSession(sessionId: string, userId: string): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - TOUCH_INTERVAL_MS);
    const updated = await db.session.updateMany({
      where: { id: sessionId, lastSeenAt: { lt: cutoff } },
      data: { lastSeenAt: new Date() },
    });
    if (updated.count > 0) {
      await db.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
    }
  } catch (error) {
    logger.warn("Failed to record session activity", { sessionId, error });
  }
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await cacheDelete(cacheKeys.session(sessionId));
}

export async function revokeAllSessions(userId: string): Promise<number> {
  const sessions = await db.session.findMany({
    where: { userId, revokedAt: null },
    select: { id: true },
  });
  if (sessions.length === 0) return 0;

  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await cacheDelete(...sessions.map((s) => cacheKeys.session(s.id)));
  return sessions.length;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  // Lax rather than Strict: the OAuth callback is a cross-site top-level
  // navigation, and Strict would drop the cookie on the redirect back.
};

export function sessionCookieAttributes(expiresAt: Date) {
  return {
    ...COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  };
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    ...COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

export const LEGACY_COOKIES = [
  "aiesec_token",
  "refresh_token",
  "token_expires_at",
  "user",
  "admin_session",
];
