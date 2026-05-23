import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type AdminSessionPayload = {
  sub: string;
  kind: "admin";
  iat: number;
  exp: number;
};

const rawSecret = process.env.ADMIN_SESSION_SECRET;
if (!rawSecret || rawSecret.length < 32) {
  throw new Error(
    `ADMIN_SESSION_SECRET must be set and at least 32 characters (got ${rawSecret?.length ?? 0})`,
  );
}
const SECRET = new TextEncoder().encode(rawSecret);

const COOKIE_NAME = "admin_session";

export async function signAdminSession(
  payload: AdminSessionPayload,
): Promise<string> {
  return new SignJWT({ kind: payload.kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function verifyAdminSession(
  token: string,
): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.kind !== "admin" || typeof payload.sub !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      kind: "admin",
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminSession(token);
}

export async function setAdminSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
