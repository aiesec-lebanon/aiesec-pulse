import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { UserRole } from "@/app/generated/prisma/enums";
import type { User } from "@/app/generated/prisma/client";
import fetchUserInfo from "@/server-utils/user-fetcher";

// Mirrors the GIS currentPerson shape stored in the "user" cookie.
// Must stay in sync with UserInfo in types/user-types.ts and ShellUser in ShellInteractive.tsx.
export type AiesecUser = {
  id: string;
  full_name: string;
  current_positions: Array<{
    office?: { id?: string; name: string; tag?: string };
    role?: { id?: string; name: string };
  }>;
};

/**
 * Derives DB role from GIS positions.
 * Any position with role.name === "MCP" → MCP; everything else → MEMBER.
 * Pure function — safe to call in layouts without a DB hit.
 */
export function deriveRole(
  positions: AiesecUser["current_positions"],
): UserRole {
  return positions.some((p) => p.role?.name === "MCP")
    ? UserRole.MCP
    : UserRole.MEMBER;
}

export async function syncUserRow(aiesecUser: AiesecUser): Promise<User> {
  const firstOffice = aiesecUser.current_positions?.[0]?.office ?? null;
  const role = deriveRole(aiesecUser.current_positions ?? []);
  return db.user.upsert({
    where: { aiesecUserId: aiesecUser.id },
    update: {
      fullName: aiesecUser.full_name,
      role,
      committeeId: firstOffice?.id ?? null,
      committeeName: firstOffice?.name ?? null,
    },
    create: {
      aiesecUserId: aiesecUser.id,
      fullName: aiesecUser.full_name,
      role,
      committeeId: firstOffice?.id ?? null,
      committeeName: firstOffice?.name ?? null,
    },
  });
}

// Role and identity are always derived from a live GIS call, never from the
// user cookie. The user cookie is client-visible and must not be trusted for
// access-control decisions. cache() deduplicates the GQL call within a single
// request when multiple server components call this function.
export const getOrSyncUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const accessToken = store.get("aiesec_token")?.value;
  if (!accessToken) return null;

  const tokenExpiresAt = store.get("token_expires_at")?.value;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = tokenExpiresAt ? Number(tokenExpiresAt) : NaN;
  if (!tokenExpiresAt || Number.isNaN(expiresAt) || expiresAt <= nowSeconds) {
    return null;
  }

  try {
    const aiesec = await fetchUserInfo(accessToken);
    if (!aiesec?.id) return null;
    return syncUserRow(aiesec);
  } catch {
    return null;
  }
});
