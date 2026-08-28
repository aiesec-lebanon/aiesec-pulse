"use server";

import { revalidatePath } from "next/cache";

import { adminActor, withAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { FLAG_KEYS, type FlagKey, invalidateFlag } from "@/lib/flags";
import { checkAdmin } from "@/lib/rbac/guards";

export type SetFlagResult = { ok: true } | { ok: false; error: string };

function isFlagKey(key: string): key is FlagKey {
  return (FLAG_KEYS as readonly string[]).includes(key);
}

export async function setFlagEnabled(key: string, enabled: boolean): Promise<SetFlagResult> {
  const authorised = await checkAdmin();
  if (!authorised.ok) return { ok: false, error: authorised.error };

  if (!isFlagKey(key)) return { ok: false, error: "Unknown flag." };

  return withAudit(
    adminActor(authorised.admin),
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
