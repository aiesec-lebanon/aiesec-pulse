"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/rbac/guards";
import { updateBioSchema } from "@/lib/zod-schemas";

/**
 * The only `User` field Pulse owns rather than mirrors from GIS (never
 * overwritten by sync) — and the only self-service write to `User`, hence
 * always `user.id`, never a caller-supplied id.
 *
 * Not audited: `AuditEvent` covers decisions about others' content
 * (approvals, hides, erasures), not a member editing their own bio.
 */
export type ProfileResult = { ok: true; bio: string | null } | { ok: false; error: string };

export async function updateOwnBio(input: { bio: string }): Promise<ProfileResult> {
  const user = await requireSession();

  const parsed = updateBioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That bio can't be saved." };
  }

  // Empty clears it to null, not "" — readers branch on null; two "no bio"
  // representations is a bug waiting to happen.
  const bio = parsed.data.bio.length > 0 ? parsed.data.bio : null;

  await db.user.update({ where: { id: user.id }, data: { bio } });

  revalidatePath("/profile");
  // Same bio shows on the public author page and on every story they wrote.
  revalidatePath(`/authors/${user.id}`);

  return { ok: true, bio };
}
