"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { adminActor, withAudit } from "@/lib/audit";
import {
  clearAdminSessionCookie,
  createAdminSession,
  getAdminSession,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "@/lib/auth/admin-session";
import { logger } from "@/lib/logger";
import { checkRateLimit, retryMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export type AdminLoginState = { error: string } | null;

// One message for a wrong address and a wrong password alike, so the form
// cannot be used to discover which of the two was right.
const REFUSED = "Those credentials were not accepted.";

const credentials = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
});

export async function adminLogin(
  _previous: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const ip = clientIp(await headers()) ?? "unknown";

  const limit = await checkRateLimit("auth", `admin-login:${ip}`);
  if (!limit.allowed) return { error: retryMessage(limit) };

  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: REFUSED };

  const { email, password } = parsed.data;
  const actor = adminActor({ email });
  const target = { type: "admin", id: email };

  if (!verifyAdminCredentials(email, password)) {
    logger.warn("Admin sign-in refused", { email });
    await withAudit(actor, "admin.sign_in_refused", target, null, async () => {});
    return { error: REFUSED };
  }

  const { token, expiresAt } = await createAdminSession();
  await withAudit(actor, "admin.signed_in", target, null, async () => {
    await setAdminSessionCookie(token, expiresAt);
  });

  redirect("/admin/roles");
}

export async function adminLogout(): Promise<void> {
  const session = await getAdminSession();
  if (session) {
    await withAudit(
      adminActor(session),
      "admin.signed_out",
      { type: "admin", id: session.email },
      null,
      clearAdminSessionCookie
    );
  }
  redirect("/admin/login");
}
