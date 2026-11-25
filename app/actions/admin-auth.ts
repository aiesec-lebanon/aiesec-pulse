"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { adminActor, recordAudit, withAudit } from "@/lib/audit";
import { ADMIN_MIN_PASSWORD_LENGTH } from "@/lib/auth/admin-policy";
import {
  ADMIN_SESSION_TARGET,
  ALL_ADMIN_SESSIONS,
  clearAdminSessionCookie,
  createAdminSession,
  getAdminSession,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "@/lib/auth/admin-session";
import { hashIp } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit, retryMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export type AdminLoginState = { error: string } | null;

// Same message for a bad email or password — avoids revealing which was wrong.
const REFUSED = "Those credentials were not accepted.";
const LOCKED = "Too many failed sign-in attempts. Try again in 15 minutes.";
const WEAK_CONFIG = `Admin sign-in is switched off until ADMIN_PASSWORD is at least ${ADMIN_MIN_PASSWORD_LENGTH} characters long. Ask the platform team to rotate it.`;

// Counted from the audit log, so the lockout holds across server instances
// (the in-memory limiter alone resets per instance).
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_PER_IP = 5;
const LOCKOUT_OVERALL = 50;

const credentials = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
});

async function isLockedOut(ipHash: string | null): Promise<boolean> {
  const where = {
    action: "admin.sign_in_refused",
    createdAt: { gte: new Date(Date.now() - LOCKOUT_WINDOW_MS) },
  };
  const [fromThisAddress, overall] = await Promise.all([
    ipHash ? db.auditEvent.count({ where: { ...where, ipHash } }) : Promise.resolve(0),
    db.auditEvent.count({ where }),
  ]);
  return fromThisAddress >= LOCKOUT_PER_IP || overall >= LOCKOUT_OVERALL;
}

export async function adminLogin(
  _previous: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const ip = clientIp(await headers()) ?? "unknown";

  const limit = await checkRateLimit("auth", `admin-login:${ip}`);
  if (!limit.allowed) return { error: retryMessage(limit) };

  if (await isLockedOut(hashIp(ip))) return { error: LOCKED };

  if (env.ADMIN_PASSWORD.length < ADMIN_MIN_PASSWORD_LENGTH) {
    logger.warn("Admin sign-in refused: ADMIN_PASSWORD is shorter than the minimum", {
      minimum: ADMIN_MIN_PASSWORD_LENGTH,
    });
    return { error: WEAK_CONFIG };
  }

  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: REFUSED };

  const { email, password } = parsed.data;
  // The configured account, never the typed text: a typo or a guess must not
  // land in the logs or the audit trail.
  const actor = adminActor({ email: env.ADMIN_EMAIL });

  if (!verifyAdminCredentials(email, password)) {
    logger.warn("Admin sign-in refused");
    await recordAudit(actor, "admin.sign_in_refused", { type: "admin", id: "credential" });
    return { error: REFUSED };
  }

  const { token, sessionId, cookieMaxAge } = await createAdminSession();
  await withAudit(
    actor,
    "admin.signed_in",
    { type: ADMIN_SESSION_TARGET, id: sessionId },
    null,
    async () => {
      await setAdminSessionCookie(token, cookieMaxAge);
    }
  );

  redirect("/admin/roles");
}

export async function adminLogout(): Promise<void> {
  const session = await getAdminSession();
  if (session) {
    // Recorded before the cookie goes: this row is what revokes the token
    // server-side, so a copied cookie stops working too.
    await recordAudit(adminActor(session), "admin.signed_out", {
      type: ADMIN_SESSION_TARGET,
      id: session.sessionId,
    });
  }
  await clearAdminSessionCookie();
  redirect("/admin/login");
}

export async function adminSignOutEverywhere(): Promise<void> {
  const session = await getAdminSession();
  if (session) {
    await recordAudit(adminActor(session), "admin.signed_out_everywhere", {
      type: ADMIN_SESSION_TARGET,
      id: ALL_ADMIN_SESSIONS,
    });
  }
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
