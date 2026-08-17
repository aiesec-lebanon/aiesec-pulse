import { type NextRequest, NextResponse } from "next/server";

import {
  ensureMockUser,
  MOCK_PERSONAS,
  mockAuthEnabled,
  type MockPersona,
} from "@/lib/auth/mock-oauth";
import { safeReturnTo } from "@/lib/auth/oauth";
import { createSession, SESSION_COOKIE, sessionCookieAttributes } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { clientIp, userAgent } from "@/lib/request";

// 404 rather than 403 when disabled: an endpoint that answers "you are not
// allowed" confirms it exists.
export async function GET(request: NextRequest) {
  if (!mockAuthEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const requested = request.nextUrl.searchParams.get("persona") ?? "member";
  if (!MOCK_PERSONAS.includes(requested as MockPersona)) {
    return NextResponse.json(
      { error: `Unknown persona. Expected one of: ${MOCK_PERSONAS.join(", ")}` },
      { status: 400 }
    );
  }

  // Bounded and sanitised so it cannot write arbitrary identifiers.
  const isolate = (request.nextUrl.searchParams.get("isolate") ?? "")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 40);

  const user = await ensureMockUser(requested as MockPersona, isolate || undefined);
  const session = await createSession(user.id, {
    userAgent: userAgent(request.headers),
    ip: clientIp(request.headers),
  });

  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const response = NextResponse.redirect(new URL(returnTo, env.NEXT_PUBLIC_BASE_URL));
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieAttributes(session.expiresAt));
  return response;
}
