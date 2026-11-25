import { jwtVerify, SignJWT } from "jose";
import { type NextRequest, NextResponse } from "next/server";

import {
  ADMIN_MAX_SECONDS,
  ADMIN_REFRESH_AFTER_SECONDS,
  ADMIN_SESSION_AUDIENCE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_ISSUER,
  adminTokenExpiry,
} from "@/lib/auth/admin-policy";
import { COOKIE_NAMES } from "@/lib/cookie-policy";

const PUBLIC_PREFIXES = [
  "/login",
  "/admin/login",
  "/unauthorized",
  "/legal",
  "/api/auth",
  "/api/health",
  "/api/cron",
];

const SESSION_COOKIE = COOKIE_NAMES.session;

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

type AdminTokenCheck =
  | { valid: false }
  | { valid: true; refreshed: { token: string; maxAge: number } | null };

// Signature, idle expiry and the hard cap only; revocation and the credential
// binding are checked by the page guards, which can reach the database.
async function checkAdminToken(
  token: string,
  rawSecret: string | undefined
): Promise<AdminTokenCheck> {
  if (!rawSecret || rawSecret.length < 32) return { valid: false };
  const key = new TextEncoder().encode(rawSecret);
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ADMIN_SESSION_ISSUER,
      audience: ADMIN_SESSION_AUDIENCE,
      algorithms: ["HS256"],
    });
    const now = Math.floor(Date.now() / 1000);
    const signedInAt = payload.sat;
    if (typeof signedInAt !== "number" || now >= signedInAt + ADMIN_MAX_SECONDS) {
      return { valid: false };
    }
    if (typeof payload.iat === "number" && now - payload.iat < ADMIN_REFRESH_AFTER_SECONDS) {
      return { valid: true, refreshed: null };
    }
    // Sliding idle window: activity pushes expiry out, never past the hard cap.
    const refreshed = await new SignJWT({ sat: signedInAt, cfp: payload.cfp })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(String(payload.sub))
      .setJti(String(payload.jti))
      .setIssuedAt(now)
      .setIssuer(ADMIN_SESSION_ISSUER)
      .setAudience(ADMIN_SESSION_AUDIENCE)
      .setExpirationTime(adminTokenExpiry(signedInAt, now))
      .sign(key);
    return {
      valid: true,
      refreshed: { token: refreshed, maxAge: signedInAt + ADMIN_MAX_SECONDS - now },
    };
  } catch {
    return { valid: false };
  }
}

function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co https://*.supabase.in https://*.aiesec.org",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in",
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

  // Console carries two identities: admin credential login and AIESEC-
  // position moderation. Either cookie passes here; page guards decide access.
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdminArea) {
    const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (adminToken) {
      const check = await checkAdminToken(adminToken, process.env.ADMIN_SESSION_SECRET);
      if (check.valid) {
        const response = proceed();
        if (check.refreshed) {
          response.cookies.set(ADMIN_SESSION_COOKIE, check.refreshed.token, {
            httpOnly: true,
            sameSite: "strict",
            secure: isProd,
            path: "/",
            maxAge: check.refreshed.maxAge,
          });
        }
        return response;
      }
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

  // Missing secret redirects, not throws, so misconfig can't become an
  // open door; the cookie is left alone since it may still be valid.
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
