import { jwtVerify } from "jose";
import { type NextRequest, NextResponse } from "next/server";

// Coarse gate only — it cannot see revocation or scope, so it must never be the
// only check. The authoritative ones are the guards in lib/rbac/guards.ts.
// Kept dependency-free: no database, no Redis, no lib/env.

const PUBLIC_PREFIXES = [
  "/login",
  "/unauthorized",
  "/legal",
  "/break-glass",
  "/api/auth",
  "/api/health",
  "/api/inngest",
];

const SESSION_COOKIE = "pulse_session";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // A nonce cannot apply to a `style="…"` attribute, which React emits for
    // dynamic values. Stylesheets and <style> blocks stay under the nonce.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co https://*.supabase.in https://*.aiesec.org",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
    "media-src 'self' https://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function applySecurityHeaders(response: NextResponse, csp: string, isProd: boolean): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  );
  response.headers.set("X-Frame-Options", "DENY");

  if (isProd) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === "development";
  const isProd = process.env.NODE_ENV === "production";

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = contentSecurityPolicy(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const proceed = () =>
    applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), csp, isProd);

  if (isPublicPath(pathname)) return proceed();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return applySecurityHeaders(redirectToLogin(request), csp, isProd);

  // Missing secret redirects rather than throws, so a misconfiguration cannot
  // turn into an open door.
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return applySecurityHeaders(redirectToLogin(request), csp, isProd);
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "aiesec-pulse",
      audience: "aiesec-pulse",
      algorithms: ["HS256"],
    });
  } catch {
    const response = redirectToLogin(request);
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return applySecurityHeaders(response, csp, isProd);
  }

  return proceed();
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = new URL("/login", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") url.searchParams.set("returnTo", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // `api` is deliberately NOT excluded — route handlers need the security
    // headers. Prefetches are, so a link hover does not force dynamic rendering.
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|txt|xml|webmanifest)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
