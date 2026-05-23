import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";

const secret = () => {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
};

export async function signAdminJwt(adminId: string): Promise<string> {
  return new SignJWT({ kind: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret());
}

export async function verifyAdminJwt(
  token: string,
): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.kind !== "admin" || typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export function setAdminSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 86400,
    path: "/",
  });
}

export function clearAdminSessionCookie(res: NextResponse): void {
  res.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
