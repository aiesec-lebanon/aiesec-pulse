import "server-only";

import type { User } from "@/app/generated/prisma/client";
import { syncIdentityFromGis } from "@/lib/auth/identity";
import { getUsableAccessToken } from "@/lib/auth/token-store";
import { logger } from "@/lib/logger";
import { fetchCurrentPerson } from "@/server-utils/gis";

/**
 * Re-fetches the user's GIS positions before a privileged write so a stale
 * or revoked grant can't authorise it. Must run BEFORE the permission
 * check: `lib/rbac/can.ts` memoises grants per request, so a check that
 * ran first would use the pre-refresh answer. Fails closed on any error.
 */
export type RevalidationResult = { ok: true } | { ok: false; error: string };

const UNCONFIRMED =
  "Your AIESEC positions could not be confirmed just now. Sign in again and retry.";

export async function revalidatePositions(user: User): Promise<RevalidationResult> {
  const token = await getUsableAccessToken(user.id);
  if (!token) {
    logger.info("Privileged action refused: no usable GIS token", { userId: user.id });
    return { ok: false, error: UNCONFIRMED };
  }

  try {
    const person = await fetchCurrentPerson(token);
    const result = await syncIdentityFromGis(person);

    // Same state that refuses sign-in: reconciliation just expired every
    // grant the check below would have read.
    if (result.recognisedPositions === 0) {
      logger.warn("Privileged action refused: no GIS position resolves any more", {
        userId: user.id,
        grantsExpired: result.grantsExpired,
      });
      return { ok: false, error: "Your AIESEC positions no longer allow this." };
    }

    return { ok: true };
  } catch (error) {
    logger.warn("Privileged action refused: GIS revalidation failed", {
      userId: user.id,
      error,
    });
    return { ok: false, error: UNCONFIRMED };
  }
}
