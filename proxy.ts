import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * The middleware runs **before every matched request** and
 * performs the following checks:
 *
 * 1. Read authentication cookies from the request
 * 2. If the access token is expired → redirect to refresh flow
 * 3. If no access token exists → redirect to login
 * 4. If a valid token exists → allow request to proceed
 */

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // ── Admin routes ──────────────────────────────────────────────────────────
    // Runs independently of AIESEC user logic — admins have no AIESEC cookies.
    if (pathname.startsWith("/admin")) {
        // Login page is always reachable; the RSC itself handles already-logged-in redirect.
        if (pathname === "/admin/login") {
            return NextResponse.next();
        }

        const adminToken = req.cookies.get("admin_session")?.value;
        if (!adminToken) {
            return NextResponse.redirect(new URL("/admin/login", req.url));
        }

        const rawSecret = process.env.ADMIN_SESSION_SECRET;
        if (!rawSecret || rawSecret.length < 32) {
            return NextResponse.redirect(new URL("/admin/login", req.url));
        }

        try {
            const { payload } = await jwtVerify(
                adminToken,
                new TextEncoder().encode(rawSecret),
            );
            if (payload.kind !== "admin") {
                return NextResponse.redirect(new URL("/admin/login", req.url));
            }
        } catch {
            return NextResponse.redirect(new URL("/admin/login", req.url));
        }

        return NextResponse.next();
    }

    // ── AIESEC user routes ────────────────────────────────────────────────────
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
    "/admin/:path*",
  ],
};
