import { type NextRequest, NextResponse } from "next/server";

import { recordAudit, systemActor, userActor } from "@/lib/audit";
import { syncIdentityFromGis } from "@/lib/auth/identity";
import { completeHandshake } from "@/lib/auth/oauth";
import {
  createSession,
  LEGACY_COOKIES,
  SESSION_COOKIE,
  sessionCookieAttributes,
} from "@/lib/auth/session";
import { exchangeCode, storeTokens } from "@/lib/auth/token-store";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { clientIp, userAgent } from "@/lib/request";
import { fetchCurrentPerson, GisUnavailableError, isPersonAllowed } from "@/server-utils/gis";

const REDIRECT_ERRORS = {
  missing_code: "We didn't receive an authorisation code from AIESEC. Please try again.",
  state_mismatch: "That sign-in link could not be verified. Please start again.",
  exchange_failed: "AIESEC could not complete the sign-in. Please try again.",
  not_permitted: "Your AIESEC account is not permitted to use Pulse.",
  gis_unavailable: "AIESEC's member directory is unavailable. Please try again shortly.",
} as const;

type ErrorCode = keyof typeof REDIRECT_ERRORS;

export const AUTH_ERROR_CODES = Object.keys(REDIRECT_ERRORS) as ErrorCode[];

function failure(baseUrl: string, code: ErrorCode): NextResponse {
  const url = new URL("/login", baseUrl);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
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

    const { user, recognisedPositions, grantsAdded, grantsExpired, denied } =
      await syncIdentityFromGis(person);

    // Authority is exactly what GIS says it is, so a person GIS gives us no
    // recognised position for has no authority at all - not even to read. There
    // is deliberately no bare `member` fallback: it would turn a renamed or
    // expired position into a working account.
    if (!user || recognisedPositions === 0) {
      await recordAudit(
        systemActor("auth"),
        "auth.sign_in_refused",
        // No Pulse account exists for a first-time refusal, so the GIS person
        // is the only identifier the record can carry.
        user ? { type: "user", id: user.id } : { type: "gis_person", id: person.id },
        {
          reason: "No GIS position resolved to a Pulse role",
          deniedReasons: denied.map((d) => d.reason),
        }
      );
      return NextResponse.redirect(new URL("/unauthorized?reason=no_position", baseUrl));
    }

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
      deniedPositionCount: denied.length,
    });
  } catch (error) {
    if (!(error instanceof GisUnavailableError)) {
      logger.error("Sign-in failed while reconciling identity", { error });
      return failure(baseUrl, "exchange_failed");
    }

    // Fail closed. There used to be a grace window here that signed a caller in
    // on their last-known identity when GIS was unreachable, and it was wrong in
    // the case it existed for: an outage is precisely when Pulse cannot tell
    // whether a position was revoked an hour ago, so the window let stale
    // authority keep working for up to three days. Authority is what GIS says it
    // is right now, or it is nothing (architecture.md ADR-027).
    logger.error("GIS unavailable; sign-in refused rather than served from cache", {
      error,
      severity: "HIGH",
      consequence: "Nobody can sign in until GIS recovers. Existing sessions are unaffected.",
    });
    return failure(baseUrl, "gis_unavailable");
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
