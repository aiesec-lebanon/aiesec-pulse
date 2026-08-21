import { jwtVerify } from "jose";
import { type NextRequest, NextResponse } from "next/server";

// Coarse gate only — it cannot see revocation or scope, so it must never be the
// only check. The authoritative ones are the guards in lib/rbac/guards.ts.
// Kept dependency-free: no database, no Redis, no lib/env.

const PUBLIC_PREFIXES = [
  "/login",
  "/admin/login",
  "/unauthorized",
  "/legal",
  "/api/auth",
  "/api/health",
  "/api/inngest",
];

const SESSION_COOKIE = "pulse_session";
const ADMIN_SESSION_COOKIE = "pulse_admin_session";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function verifies(token: string, rawSecret: string | undefined, audience: string) {
  if (!rawSecret || rawSecret.length < 32) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(rawSecret), {
      issuer: "aiesec-pulse",
      audience,
      algorithms: ["HS256"],
    });
    return true;
  } catch {
    return false;
  }
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

  // The console carries both identities: platform administration signs in with
  // a credential, moderation with an AIESEC position. Either cookie gets past
  // this gate; which pages it actually opens is settled by the page guards.
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdminArea) {
    const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (
      adminToken &&
      (await verifies(adminToken, process.env.ADMIN_SESSION_SECRET, "aiesec-pulse-admin"))
    ) {
      return proceed();
    }
  }

  const refuse = () =>
    applySecurityHeaders(
      isAdminArea ? redirectToAdminLogin(request) : redirectToLogin(request),
      csp,
      isProd
    );

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return refuse();

  // Missing secret redirects rather than throws, so a misconfiguration cannot
  // turn into an open door. The cookie is left alone in that case — it may well
  // be valid, and signing everyone out is not the right answer to a bad deploy.
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return refuse();

  if (!(await verifies(token, secret, "aiesec-pulse"))) {
    const response = isAdminArea ? redirectToAdminLogin(request) : redirectToLogin(request);
    response.cookies.delete(SESSION_COOKIE);
    return applySecurityHeaders(response, csp, isProd);
  }

  return proceed();
}

function redirectToAdminLogin(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/admin/login", request.url));
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
