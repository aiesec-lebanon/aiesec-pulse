import { NextRequest, NextResponse } from "next/server";

/**
 * The middleware runs **before every matched request** and
 * performs the following checks:
 *
 * 1. Read authentication cookies from the request
 * 2. If the access token is expired → redirect to refresh flow
 * 3. If no access token exists → redirect to login
 * 4. If a valid token exists → allow request to proceed
 */

export function proxy(req: NextRequest) {

    const aiesecToken = req.cookies.get("aiesec_token")?.value;
    const refreshToken = req.cookies.get("refresh_token")?.value;
    const tokenExpiresAt = req.cookies.get("token_expires_at")?.value;

    if (tokenExpiresAt && Date.now() > Number(tokenExpiresAt) * 1000) {

        if (!refreshToken) {
            return NextResponse.redirect(new URL("/login", req.url));
        }

        const refreshUrl = new URL("/api/auth/refresh", req.url);
        refreshUrl.searchParams.set("redirect", req.nextUrl.pathname);

        return NextResponse.redirect(refreshUrl);
    }

    if (!aiesecToken) {
        const loginUrl = new URL("/login", req.url);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}


/**
 * Defines which routes the middleware should run on.
 */

export const config = {
  matcher: [
    /*
     * Apply to all routes except:
     *
     * - /login              → authentication entry point
     * - /api/auth/*         → OAuth callback and auth endpoints
     * - /unauthorized       → page shown when user lacks permission
     * - /_next/static/*     → Next.js static assets
     * - /_next/image/*      → Next.js optimized images
     * - static files        → public assets
     */
    "/((?!login|api/auth|unauthorized|_next/static|_next/image|aiesec_man.png).*)",
  ],
};