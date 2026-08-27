"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/rbac/guards";
import { updateBioSchema } from "@/lib/zod-schemas";

/**
 * A member's own standfirst.
 *
 * The only field on `User` that Pulse owns rather than mirrors: GIS has no bio
 * and no way for an application to write one back, so unlike a name, an email
 * or an office this one is never overwritten by a sync. It is also the only
 * self-service write to `User` in the product, which is why the guard is
 * `requireSession` and the target is always `user.id` — there is no path here
 * that takes an id from the caller.
 *
 * Not audited. `AuditEvent` records decisions taken *about* other people's
 * content — approvals, rejections, hides, erasures. A member editing their own
 * one-line bio is not that, and logging it would bury the events that matter.
 */
export type ProfileResult = { ok: true; bio: string | null } | { ok: false; error: string };

export async function updateOwnBio(input: { bio: string }): Promise<ProfileResult> {
  const user = await requireSession();

  const parsed = updateBioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That bio can't be saved." };
  }

  // Empty clears it, rather than storing "". A null bio is what every reader of
  // this field branches on, and two representations of "no bio" is a bug
  // waiting for whichever surface forgets the second one.
  const bio = parsed.data.bio.length > 0 ? parsed.data.bio : null;

  await db.user.update({ where: { id: user.id }, data: { bio } });

  revalidatePath("/profile");
  // The same text is this member's standfirst on their public page, and on
  // every story they wrote.
  revalidatePath(`/authors/${user.id}`);

  return { ok: true, bio };
}
