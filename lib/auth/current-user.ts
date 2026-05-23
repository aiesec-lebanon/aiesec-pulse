import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { UserRole } from "@/app/generated/prisma/enums";
import type { User } from "@/app/generated/prisma/client";

export type AiesecUser = {
  id: string;
  full_name: string;
  current_positions: Array<{
    committee?: { id: string; name: string };
    role?: { name: string };
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
  const firstCommittee = aiesecUser.current_positions?.[0]?.committee ?? null;
  return db.user.upsert({
    where: { aiesecUserId: aiesecUser.id },
    update: {
      fullName: aiesecUser.full_name,
      committeeId: firstCommittee?.id ?? null,
      committeeName: firstCommittee?.name ?? null,
    },
    create: {
      aiesecUserId: aiesecUser.id,
      fullName: aiesecUser.full_name,
      role: UserRole.MCP,
      committeeId: firstCommittee?.id ?? null,
      committeeName: firstCommittee?.name ?? null,
    },
  });
}

export async function getOrSyncUser(): Promise<User | null> {
  const aiesec = await getCurrentAiesecUser();
  if (!aiesec) return null;
  return syncUserRow(aiesec);
}
