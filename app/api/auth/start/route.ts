import { type NextRequest, NextResponse } from "next/server";

import { authorizeUrl, beginHandshake, safeReturnTo } from "@/lib/auth/oauth";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export async function GET(request: NextRequest) {
  const ip = clientIp(request.headers);

  // Throttled per IP: /authorize is unauthenticated and would otherwise be a
  // free amplifier pointed at auth.aiesec.org.
  const limit = await checkRateLimit("auth", ip ?? "unknown");
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const handshake = await beginHandshake(returnTo);

  logger.info("OAuth handshake started", { returnTo, pkce: handshake.codeVerifier !== null });

  return NextResponse.redirect(authorizeUrl(handshake));
}
