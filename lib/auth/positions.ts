import "server-only";

import type { User } from "@/app/generated/prisma/client";
import { syncIdentityFromGis } from "@/lib/auth/identity";
import { getUsableAccessToken } from "@/lib/auth/token-store";
import { logger } from "@/lib/logger";
import { fetchCurrentPerson } from "@/server-utils/gis";

/**
 * architecture.md §6.3: persisted grants are authoritative for reads, but a
 * stale grant must not authorise a write. Before a privileged action the acting
 * user's positions are re-fetched from GIS and reconciled inside the same
 * request, so a position that has disappeared or changed since login fails the
 * action rather than being spent on it.
 *
 * This is the middle path the document describes, not a per-request GIS call:
 * Pulse pays the latency only where authority is actually being exercised.
 *
 * Call it **before** the permission check, never after. Reconciliation ends
 * grants that GIS no longer returns and busts the authorisation cache, and
 * `lib/rbac/can.ts` memoises grants per request — a check that ran first would
 * hold the answer from before the refresh.
 *
 * Fails closed on every branch. §6.4 has no degraded mode and no staleness
 * ceiling: if GIS cannot confirm the position now, the position does not
 * authorise anything now.
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

    // Zero recognised positions is the same state that refuses a sign-in, so it
    // refuses a privileged action too — reconciliation has just expired every
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
