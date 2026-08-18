"use server";

import { revalidatePath } from "next/cache";

import { userActor, withAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { FLAG_KEYS, type FlagKey, invalidateFlag } from "@/lib/flags";
import { checkPermission } from "@/lib/rbac/guards";

export type SetFlagResult = { ok: true } | { ok: false; error: string };

function isFlagKey(key: string): key is FlagKey {
  return (FLAG_KEYS as readonly string[]).includes(key);
}

// Every gated feature ships off by default and is flipped on here, one flag
// at a time, so a bad milestone is one toggle away from off without a
// rollback deploy (architecture.md §18.2).
export async function setFlagEnabled(key: string, enabled: boolean): Promise<SetFlagResult> {
  const authorised = await checkPermission("admin.configure");
  if (!authorised.ok) return { ok: false, error: authorised.error };

  if (!isFlagKey(key)) return { ok: false, error: "Unknown flag." };

  return withAudit(
    userActor(authorised.user),
    "flag.toggled",
    { type: "feature_flag", id: key },
    { enabled },
    async () => {
      await db.featureFlag.upsert({
        where: { key },
        update: { enabled },
        create: { key, enabled },
      });
      await invalidateFlag(key);
      revalidatePath("/admin/flags");
      return { ok: true as const };
    }
  );
}
