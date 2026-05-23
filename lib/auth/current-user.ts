import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { UserRole } from "@/app/generated/prisma/enums";
import type { User } from "@/app/generated/prisma/client";

// Mirrors the GIS currentPerson shape stored in the "user" cookie.
// Must stay in sync with UserInfo in types/user-types.ts and ShellUser in ShellInteractive.tsx.
export type AiesecUser = {
  id: string;
  full_name: string;
  current_positions: Array<{
    office?: { id: string; name: string; tag?: string };
    role?: { id?: string; name: string };
  }>;
};

export async function getCurrentAiesecUser(): Promise<AiesecUser | null> {
  const store = await cookies();
  const raw = store.get("user")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiesecUser;
  } catch {
    return null;
  }
}

export async function syncUserRow(aiesecUser: AiesecUser): Promise<User> {
  const firstOffice = aiesecUser.current_positions?.[0]?.office ?? null;
  return db.user.upsert({
    where: { aiesecUserId: aiesecUser.id },
    update: {
      fullName: aiesecUser.full_name,
      committeeId: firstOffice?.id ?? null,
      committeeName: firstOffice?.name ?? null,
    },
    create: {
      aiesecUserId: aiesecUser.id,
      fullName: aiesecUser.full_name,
      role: UserRole.MCP,
      committeeId: firstOffice?.id ?? null,
      committeeName: firstOffice?.name ?? null,
    },
  });
}

export async function getOrSyncUser(): Promise<User | null> {
  const aiesec = await getCurrentAiesecUser();
  // id is missing from cookies baked before the GQL query included currentPerson.id.
  // Treat as unauthenticated so requireUser() redirects to /login for a fresh cookie.
  if (!aiesec || !aiesec.id) return null;
  return syncUserRow(aiesec);
}
