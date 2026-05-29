import { redirect } from "next/navigation";
import {
  getAdminSession,
  type AdminSessionPayload,
} from "@/lib/auth/admin-session";
import { getOrSyncUser } from "@/lib/auth/current-user";
import { UserRole } from "@/app/generated/prisma/enums";
import type { User } from "@/app/generated/prisma/client";

export async function requireAdmin(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function requireUser(): Promise<User> {
  const user = await getOrSyncUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireMCP(): Promise<User> {
  const user = await requireUser();
  if (user.role !== UserRole.MCP) redirect("/unauthorized");
  return user;
}
