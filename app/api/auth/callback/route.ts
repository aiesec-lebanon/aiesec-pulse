import { type NextRequest, NextResponse } from "next/server";

import { recordAudit, systemActor, userActor } from "@/lib/audit";
import { isWithinStalenessCeiling, syncIdentityFromGis } from "@/lib/auth/identity";
import { completeHandshake } from "@/lib/auth/oauth";
import {
  createSession,
  LEGACY_COOKIES,
  SESSION_COOKIE,
  sessionCookieAttributes,
  verifySessionToken,
} from "@/lib/auth/session";
import { exchangeCode, storeTokens } from "@/lib/auth/token-store";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { clientIp, userAgent } from "@/lib/request";
import { fetchCurrentPerson, GisUnavailableError, isPersonAllowed } from "@/server-utils/gis";

const REDIRECT_ERRORS = {
  missing_code: "We didn't receive an authorisation code from AIESEC. Please try again.",
  state_mismatch: "That sign-in link could not be verified. Please start again.",
  exchange_failed: "AIESEC could not complete the sign-in. Please try again.",
  not_permitted: "Your AIESEC account is not permitted to use Pulse.",
  gis_unavailable:
    "AIESEC's member directory is unavailable and we have no recent record of your account.",
} as const;

type ErrorCode = keyof typeof REDIRECT_ERRORS;

export const AUTH_ERROR_CODES = Object.keys(REDIRECT_ERRORS) as ErrorCode[];

function failure(baseUrl: string, code: ErrorCode): NextResponse {
  const url = new URL("/login", baseUrl);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

type CachedIdentity = { id: string; fullName: string; lastSyncedAt: Date | null; status: string };

async function resolveCachedIdentity(token: string | undefined): Promise<CachedIdentity | null> {
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const session = await db.session.findUnique({
    where: { id: claims.jti },
    select: {
      userId: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { id: true, fullName: true, lastSyncedAt: true, status: true } },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  if (session.userId !== claims.sub) return null;

  return session.user;
}

export async function GET(request: NextRequest) {
  const baseUrl = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  const params = request.nextUrl.searchParams;

  const providerError = params.get("error");
  if (providerError) {
    logger.info("AIESEC returned an OAuth error", { providerError });
    return failure(baseUrl, "exchange_failed");
  }

  // `state` first, always — before the code is spent on anything.
  const handshake = await completeHandshake(params.get("state"));
  if (!handshake.ok) {
    logger.warn("OAuth callback rejected", {
      reason: handshake.reason,
      note: "Possible login-CSRF attempt, or a stale/expired sign-in tab.",
    });
    return failure(baseUrl, "state_mismatch");
  }

  const code = params.get("code");
  if (!code) return failure(baseUrl, "missing_code");

  let tokens;
  try {
    tokens = await exchangeCode(code, handshake.codeVerifier ?? undefined);
  } catch (error) {
    logger.error("Authorization code exchange failed", { error });
    return failure(baseUrl, "exchange_failed");
  }

  let userId: string;
  let userLabel: string;

  try {
    const person = await fetchCurrentPerson(tokens.accessToken);

    if (!isPersonAllowed(person)) {
      logger.info("Sign-in refused by the access policy", { aiesecPersonId: person.id });
      return failure(baseUrl, "not_permitted");
    }

    const { user, grantsAdded, grantsExpired, unmatchedTitles } = await syncIdentityFromGis(person);

    if (user.status === "ERASED" || user.status === "SUSPENDED") {
      return failure(baseUrl, "not_permitted");
    }

    userId = user.id;
    userLabel = user.fullName;
    await storeTokens(user.id, tokens);

    logger.info("Identity reconciled from GIS", {
      userId: user.id,
      grantsAdded,
      grantsExpired,
      unmatchedTitleCount: unmatchedTitles.length,
    });
  } catch (error) {
    if (!(error instanceof GisUnavailableError)) {
      logger.error("Sign-in failed while reconciling identity", { error });
      return failure(baseUrl, "exchange_failed");
    }

    // GIS outage: fall back to a cached identity within the staleness ceiling.
    // The account is taken from the signed token and a live session row, never
    // from the raw cookie — otherwise an outage becomes a way to sign in as
    // whoever logged in most recently.
    const fallback = await resolveCachedIdentity(request.cookies.get(SESSION_COOKIE)?.value);

    if (
      !fallback ||
      fallback.status !== "ACTIVE" ||
      !isWithinStalenessCeiling(fallback.lastSyncedAt)
    ) {
      logger.error("GIS unavailable and no identity within the staleness ceiling", { error });
      return failure(baseUrl, "gis_unavailable");
    }

    userId = fallback.id;
    userLabel = fallback.fullName;
    await storeTokens(fallback.id, tokens);
    logger.warn("Signed in on cached identity during a GIS outage", {
      userId: fallback.id,
      lastSyncedAt: fallback.lastSyncedAt?.toISOString(),
    });
    await recordAudit(
      systemActor("auth"),
      "auth.sign_in_degraded",
      { type: "user", id: fallback.id },
      {
        reason: "GIS unavailable; served from cached identity within the 72h ceiling",
      }
    );
  }

  const session = await createSession(userId, {
    userAgent: userAgent(request.headers),
    ip: clientIp(request.headers),
  });

  await recordAudit(userActor({ id: userId, fullName: userLabel }), "auth.sign_in", {
    type: "session",
    id: session.sessionId,
  });

  const response = NextResponse.redirect(new URL(handshake.returnTo, baseUrl));
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieAttributes(session.expiresAt));

  for (const name of LEGACY_COOKIES) {
    if (name === SESSION_COOKIE) continue;
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }

  return response;
}
