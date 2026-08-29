import { type NextRequest, NextResponse } from "next/server";

import { recordAudit, userActor } from "@/lib/audit";
import {
  clearSessionCookie,
  getActiveSession,
  LEGACY_COOKIES,
  revokeAllSessions,
  revokeSession,
} from "@/lib/auth/session";
import { deleteTokens } from "@/lib/auth/token-store";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isSameOrigin } from "@/lib/request";

// POST-only + origin check — a GET logout is a one-pixel-image CSRF. The
// revoked row is what actually stops a stolen cookie, not clearing it.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers, env.NEXT_PUBLIC_BASE_URL)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const session = await getActiveSession();
  const everywhere = request.nextUrl.searchParams.get("everywhere") === "1";

  if (session) {
    if (everywhere) {
      const revoked = await revokeAllSessions(session.userId);
      await deleteTokens(session.userId);
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { fullName: true },
      });
      await recordAudit(
        userActor({ id: session.userId, fullName: user?.fullName ?? "Unknown" }),
        "auth.sign_out_everywhere",
        { type: "user", id: session.userId },
        { sessionsRevoked: revoked }
      );
    } else {
      await revokeSession(session.sessionId);
    }
  }

  await clearSessionCookie();

  const response = NextResponse.redirect(new URL("/login", env.NEXT_PUBLIC_BASE_URL), {
    status: 303,
  });
  for (const name of LEGACY_COOKIES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return response;
}
