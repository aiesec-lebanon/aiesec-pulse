"use server";

import { FollowTarget } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/rbac/guards";

export type FollowState = "none" | "following" | "muted";

async function targetExists(targetType: FollowTarget, targetId: string): Promise<boolean> {
  if (targetType === FollowTarget.TOPIC) {
    return (await db.topic.count({ where: { id: targetId, isActive: true } })) > 0;
  }
  if (targetType === FollowTarget.ENTITY) {
    return (await db.entity.count({ where: { id: targetId, isActive: true } })) > 0;
  }
  return (await db.user.count({ where: { id: targetId, status: "ACTIVE" } })) > 0;
}

export type ToggleFollowResult = { ok: true; state: FollowState } | { ok: false; error: string };

/**
 * Follow and mute share one row — `muted` inverts the signal, per the
 * schema's own comment on Follow. Toggling the state this call doesn't
 * currently hold flips the row to the new polarity rather than requiring a
 * separate unfollow/unmute first; toggling the state it already holds
 * removes the row, back to no explicit preference.
 */
async function toggle(
  targetType: FollowTarget,
  targetId: string,
  wantMuted: boolean
): Promise<ToggleFollowResult> {
  const user = await requireSession();
  const where = { userId_targetType_targetId: { userId: user.id, targetType, targetId } };

  // Independent reads, run concurrently rather than as two sequential round
  // trips — neither depends on the other's result.
  const [exists, existing] = await Promise.all([
    targetExists(targetType, targetId),
    db.follow.findUnique({ where, select: { muted: true } }),
  ]);
  if (!exists) {
    return { ok: false, error: "That no longer exists." };
  }

  if (!existing) {
    await db.follow.create({ data: { userId: user.id, targetType, targetId, muted: wantMuted } });
  } else if (existing.muted === wantMuted) {
    await db.follow.delete({ where });
    return { ok: true, state: "none" };
  } else {
    await db.follow.update({ where, data: { muted: wantMuted } });
  }

  return { ok: true, state: wantMuted ? "muted" : "following" };
}

export async function toggleFollow(
  targetType: FollowTarget,
  targetId: string
): Promise<ToggleFollowResult> {
  return toggle(targetType, targetId, false);
}

export async function toggleMute(
  targetType: FollowTarget,
  targetId: string
): Promise<ToggleFollowResult> {
  return toggle(targetType, targetId, true);
}

/** Backs the "Following" settings panel — removes a follow or mute outright. */
export async function removeFollow(
  targetType: FollowTarget,
  targetId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireSession();

  await db.follow.deleteMany({ where: { userId: user.id, targetType, targetId } });
  return { ok: true };
}
