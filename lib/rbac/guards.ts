import "server-only";

import { redirect } from "next/navigation";

import type { User } from "@/app/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logger } from "@/lib/logger";
import { can, GLOBAL_SCOPE, type ScopeRef } from "@/lib/rbac/can";
import type { PermissionKey } from "@/lib/rbac/catalogue";

// The authoritative check, and the mandatory first statement of every Server
// Action and protected Route Handler — the no-unguarded-server-action ESLint
// rule fails the build without one. Guards redirect rather than throw.

export async function requireSession(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// GLOBAL_SCOPE asks "anywhere at all", which is right for a nav item and wrong
// for a mutation: an action must pass the entity it writes to.
export async function requirePermission(
  permission: PermissionKey,
  scope: ScopeRef = GLOBAL_SCOPE
): Promise<User> {
  const user = await requireSession();

  if (!(await can(user, permission, scope))) {
    logger.info("Permission denied", {
      userId: user.id,
      permission,
      scope: scope.type === "GLOBAL" ? "GLOBAL" : `${scope.type}:${scope.entityId}`,
    });
    redirect("/unauthorized");
  }
  return user;
}

export async function requireSelfOrPermission(
  ownerId: string,
  permission: PermissionKey,
  scope: ScopeRef = GLOBAL_SCOPE
): Promise<User> {
  const user = await requireSession();
  if (user.id === ownerId) return user;
  if (await can(user, permission, scope)) return user;

  logger.info("Ownership check failed and permission is absent", {
    userId: user.id,
    ownerId,
    permission,
  });
  redirect("/unauthorized");
}

export type AuthzFailure = { ok: false; error: string; code: "unauthenticated" | "forbidden" };

export async function checkPermission(
  permission: PermissionKey,
  scope: ScopeRef = GLOBAL_SCOPE
): Promise<{ ok: true; user: User } | AuthzFailure> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, code: "unauthenticated", error: "Sign in to continue." };
  }
  if (!(await can(user, permission, scope))) {
    return {
      ok: false,
      code: "forbidden",
      error: "You do not have permission to do that.",
    };
  }
  return { ok: true, user };
}
