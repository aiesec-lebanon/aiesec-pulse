"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcryptjs from "bcryptjs";
import { db } from "@/lib/db";
import {
  signAdminSession,
  setAdminSessionCookie,
  clearAdminSessionCookie,
} from "@/lib/auth/admin-session";
import { adminLoginSchema } from "@/lib/zod-schemas";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export type AdminLoginState = { ok: false; error: string } | null;

const GENERIC_ERROR = "Invalid email or password.";

export async function adminLogin(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

  if (!checkRateLimit(ip)) {
    return { ok: false, error: "Too many attempts. Try again in 15 minutes." };
  }

  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { email, password } = parsed.data;

  const admin = await db.admin.findUnique({ where: { email } });
  if (!admin) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const match = await bcryptjs.compare(password, admin.passwordHash);
  if (!match) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const token = await signAdminSession({
    sub: admin.id,
    kind: "admin",
    iat: 0,
    exp: 0,
  });
  await setAdminSessionCookie(token);

  redirect("/admin/queue");
}

export async function adminLogout(): Promise<never> {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
