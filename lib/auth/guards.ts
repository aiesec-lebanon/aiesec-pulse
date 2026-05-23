import { redirect } from "next/navigation";
import {
  getAdminSession,
  type AdminSessionPayload,
} from "@/lib/auth/admin-session";
import { getOrSyncUser } from "@/lib/auth/current-user";
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

// MVP: role derivation deferred (architecture §6.4 + context.md §8.1).
// All authenticated AIESEC users are admitted as MCP for the demo.
// When server-side role derivation ships, restore the check:
//   if (user.role !== 'MCP') { throw forbidden(); }
export async function requireMCP(): Promise<User> {
  const user = await requireUser();
  return user;
}
