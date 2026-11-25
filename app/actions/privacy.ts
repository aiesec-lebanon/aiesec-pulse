"use server";

import { revalidatePath } from "next/cache";

import { adminActor, userActor, withAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  buildExportBundle,
  type DsrKind,
  type ErasureChoice,
  executeErasure,
  openRequest,
} from "@/lib/privacy/dsr";
import { checkAdmin, requireSession } from "@/lib/rbac/guards";
import { dataSubjectRequestSchema } from "@/lib/zod-schemas";

// Erasure is the only hard deletion in the product. It is reachable only from
// the credential admin console — no AIESEC position resolves to it.

export type PrivacyResult = { ok: true; requestId?: string } | { ok: false; error: string };

export async function raiseOwnRequest(input: {
  kind: DsrKind;
  notes?: string;
}): Promise<PrivacyResult> {
  const user = await requireSession();

  const parsed = dataSubjectRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const existing = await db.dataSubjectRequest.findFirst({
    where: { userId: user.id, kind: parsed.data.kind, status: { in: ["RECEIVED", "IN_PROGRESS"] } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "You already have a request of this type open. We'll be in touch." };
  }

  const requestId = await openRequest({
    userId: user.id,
    email: user.email,
    kind: parsed.data.kind,
    notes: parsed.data.notes,
  });

  revalidatePath("/settings/privacy");
  return { ok: true, requestId };
}

export async function exportOwnData(): Promise<
  { ok: true; bundle: string } | { ok: false; error: string }
> {
  const user = await requireSession();

  return withAudit(
    userActor(user),
    "privacy.self_export",
    { type: "user", id: user.id },
    null,
    async () => {
      const bundle = await buildExportBundle(user.id);
      return { ok: true as const, bundle: JSON.stringify(bundle, null, 2) };
    }
  );
}

export async function advanceRequest(
  requestId: string,
  status: "IN_PROGRESS" | "COMPLETED" | "REFUSED",
  notes: string
): Promise<PrivacyResult> {
  const authorised = await checkAdmin();
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const request = await db.dataSubjectRequest.findUnique({
    where: { id: requestId },
    select: { kind: true, userId: true },
  });
  if (!request) return { ok: false, error: "Request not found." };

  return withAudit(
    adminActor(authorised.admin),
    `dsr.${status.toLowerCase()}`,
    { type: "data_subject_request", id: requestId },
    { kind: request.kind, notes },
    async () => {
      const closing = status === "COMPLETED" || status === "REFUSED";
      await db.dataSubjectRequest.update({
        where: { id: requestId },
        data: {
          status,
          notes,
          handledById: null,
          completedAt: closing ? new Date() : null,
          // The contact address is only needed while the request is open.
          ...(closing ? { email: null } : {}),
        },
      });
      revalidatePath("/admin/privacy");
      return { ok: true as const };
    }
  );
}

// A message from the public contact form arrives unlinked; once the sender's
// identity is checked, linking it lets erasure and export act on the account.
export async function linkRequestToAccount(
  requestId: string,
  identifier: string
): Promise<PrivacyResult> {
  const authorised = await checkAdmin();
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const lookup = identifier.trim().slice(0, 320);
  if (!lookup) return { ok: false, error: "Enter the member's email or EXPA ID." };

  const request = await db.dataSubjectRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, status: true },
  });
  if (!request) return { ok: false, error: "Request not found." };
  if (request.userId) return { ok: false, error: "This request is already linked to an account." };
  if (request.status === "COMPLETED" || request.status === "REFUSED") {
    return { ok: false, error: "This request is closed." };
  }

  const matches = await db.user.findMany({
    where: lookup.includes("@")
      ? { email: { equals: lookup, mode: "insensitive" } }
      : { aiesecPersonId: lookup },
    select: { id: true },
    take: 2,
  });
  if (matches.length === 0) {
    return { ok: false, error: "No Pulse account matches that email or EXPA ID." };
  }
  if (matches.length > 1) {
    return { ok: false, error: "More than one account uses that email. Use the EXPA ID instead." };
  }
  const userId = matches[0].id;

  return withAudit(
    adminActor(authorised.admin),
    "dsr.linked",
    { type: "data_subject_request", id: requestId },
    { userId },
    async () => {
      await db.dataSubjectRequest.update({ where: { id: requestId }, data: { userId } });
      revalidatePath("/admin/privacy");
      return { ok: true as const };
    }
  );
}

export async function executeErasureRequest(
  requestId: string,
  choice: ErasureChoice
): Promise<PrivacyResult> {
  const authorised = await checkAdmin();
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const request = await db.dataSubjectRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, kind: true, status: true },
  });
  if (!request) return { ok: false, error: "Request not found." };
  if (request.kind !== "ERASURE") return { ok: false, error: "That request is not an erasure." };
  if (!request.userId) {
    return {
      ok: false,
      error:
        "This request is not linked to an account. Verify the subject's identity and link it first.",
    };
  }
  if (request.status === "COMPLETED") return { ok: false, error: "Already completed." };

  await executeErasure(request.userId, choice, adminActor(authorised.admin));

  await db.dataSubjectRequest.update({
    where: { id: requestId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      handledById: null,
      email: null,
      notes: `Erasure executed with content election: ${choice}.`,
    },
  });

  revalidatePath("/admin/privacy");
  return { ok: true };
}
