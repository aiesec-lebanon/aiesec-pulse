import "server-only";

import bcryptjs from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { authenticator } from "otplib";

import { ActorType } from "@/app/generated/prisma/enums";
import { decryptFromBytes, encryptToBytes, hashIp } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env, has } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

// Not the normal admin path — platform admins sign in through AIESEC OAuth.
// Every choice here trades convenience for traceability, because the account
// that can do anything is the one that must never be used quietly.

const COOKIE = "pulse_break_glass";

const SESSION_TTL_SECONDS = 60 * 60;

export type BreakGlassSession = { adminId: string; email: string; expiresAt: number };

function secret(): Uint8Array {
  return new TextEncoder().encode(`${env.SESSION_SECRET}:break-glass`);
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpProvisioningUri(email: string, secretValue: string): string {
  return authenticator.keyuri(email, "AIESEC Pulse (break-glass)", secretValue);
}

export async function enrolTotp(email: string, totpSecret: string): Promise<void> {
  await db.breakGlassAdmin.update({
    where: { email },
    data: { totpSecretEnc: new Uint8Array(encryptToBytes(totpSecret)), isActive: true },
  });
}

// The alert is the control: a break-glass credential that can be used without
// anyone finding out is just a second admin password.
async function alert(event: string, detail: Record<string, unknown>): Promise<void> {
  logger.error(`BREAK GLASS: ${event}`, { severity: "CRITICAL", ...detail });

  if (!has.breakGlassAlerting()) return;
  try {
    await fetch(process.env.BREAK_GLASS_ALERT_WEBHOOK!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 AIESEC Pulse break-glass: ${event}`,
        detail,
        at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    logger.error("Break-glass alert webhook failed", { error });
  }
}

export type BreakGlassResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; error: string };

const GENERIC_ERROR = "Invalid credentials.";

export async function signInBreakGlass(input: {
  email: string;
  password: string;
  totp: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<BreakGlassResult> {
  const limit = await checkRateLimit("breakGlass", input.ip ?? "unknown");
  if (!limit.allowed) {
    await alert("rate limit exceeded", { email: input.email, ipHash: hashIp(input.ip) });
    return { ok: false, error: "Too many attempts. Try again later." };
  }

  const admin = await db.breakGlassAdmin.findUnique({ where: { email: input.email } });

  // Uniform failure copy: distinguishing "no such account" from "wrong
  // password" turns this form into an account enumerator.
  if (!admin || !admin.isActive || !admin.totpSecretEnc) {
    await bcryptjs.compare(
      input.password,
      "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv"
    );
    await alert("failed sign-in", {
      email: input.email,
      reason: !admin ? "unknown account" : !admin.isActive ? "inactive" : "no TOTP enrolled",
      ipHash: hashIp(input.ip),
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  if (!(await bcryptjs.compare(input.password, admin.passwordHash))) {
    await alert("failed sign-in", {
      email: input.email,
      reason: "bad password",
      ipHash: hashIp(input.ip),
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  let totpSecret: string;
  try {
    totpSecret = decryptFromBytes(admin.totpSecretEnc);
  } catch (error) {
    await alert("TOTP secret undecryptable", { email: input.email, error });
    return { ok: false, error: GENERIC_ERROR };
  }

  if (!authenticator.verify({ token: input.totp.replace(/\s/g, ""), secret: totpSecret })) {
    await alert("failed sign-in", {
      email: input.email,
      reason: "bad TOTP",
      ipHash: hashIp(input.ip),
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const token = await new SignJWT({ kind: "break_glass", email: admin.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(admin.id)
    .setIssuedAt()
    .setIssuer("aiesec-pulse")
    .setAudience("aiesec-pulse-break-glass")
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());

  await db.breakGlassAdmin.update({ where: { id: admin.id }, data: { lastUsedAt: new Date() } });

  await db.auditEvent.create({
    data: {
      actorType: ActorType.BREAK_GLASS,
      actorId: admin.id,
      actorLabel: admin.email,
      action: "break_glass.sign_in",
      targetType: "break_glass_admin",
      targetId: admin.id,
      ipHash: hashIp(input.ip),
      userAgent: input.userAgent?.slice(0, 500) ?? null,
    },
  });

  await alert("SUCCESSFUL sign-in", {
    email: admin.email,
    ipHash: hashIp(input.ip),
    expiresAt: expiresAt.toISOString(),
    action: "Confirm this was expected; if not, treat it as a security incident.",
  });

  return { ok: true, token, expiresAt };
}

export async function getBreakGlassSession(): Promise<BreakGlassSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "aiesec-pulse",
      audience: "aiesec-pulse-break-glass",
      algorithms: ["HS256"],
    });
    if (payload.kind !== "break_glass" || typeof payload.sub !== "string") return null;

    const admin = await db.breakGlassAdmin.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, email: true },
    });
    if (!admin?.isActive) return null;

    return { adminId: payload.sub, email: admin.email, expiresAt: (payload.exp ?? 0) * 1000 };
  } catch {
    return null;
  }
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Strict is viable here: there is no cross-site entry point into the
  // emergency console.
  sameSite: "strict" as const,
  path: "/",
});

export async function setBreakGlassCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, token, { ...cookieOptions(), expires: expiresAt });
}

export async function clearBreakGlassCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}
