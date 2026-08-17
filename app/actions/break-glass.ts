"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { breakGlassActor, recordAudit } from "@/lib/audit";
import {
  clearBreakGlassCookie,
  getBreakGlassSession,
  setBreakGlassCookie,
  signInBreakGlass,
} from "@/lib/auth/break-glass";
import { clientIp, userAgent } from "@/lib/request";
import { breakGlassLoginSchema } from "@/lib/zod-schemas";

// The only Server Actions without an RBAC guard, and the ESLint rule allowlists
// the file for that reason: break-glass exists for when the RBAC path is down,
// so guarding it with the system it replaces would make it useless. Password +
// TOTP, a fail-closed rate limit, an alert and an audit row replace the guard.

export type BreakGlassState = { error: string } | null;

export async function breakGlassSignIn(
  _previous: BreakGlassState,
  formData: FormData
): Promise<BreakGlassState> {
  const headerStore = await headers();

  const parsed = breakGlassLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totp: formData.get("totp"),
  });
  // Uniform copy: distinguishing "no such account" from "wrong code" is an oracle.
  if (!parsed.success) return { error: "Invalid credentials." };

  const result = await signInBreakGlass({
    ...parsed.data,
    ip: clientIp(headerStore),
    userAgent: userAgent(headerStore),
  });

  if (!result.ok) return { error: result.error };

  await setBreakGlassCookie(result.token, result.expiresAt);
  redirect("/break-glass/console");
}

export async function breakGlassSignOut(): Promise<never> {
  const session = await getBreakGlassSession();
  if (session) {
    await recordAudit(breakGlassActor(session), "break_glass.sign_out", {
      type: "break_glass_admin",
      id: session.adminId,
    });
  }
  await clearBreakGlassCookie();
  redirect("/break-glass");
}
