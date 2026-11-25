"use server";

import { headers } from "next/headers";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hashIp } from "@/lib/crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { contactNotes, type ContactState, validateContact } from "@/lib/privacy/contact";
import { openRequest } from "@/lib/privacy/dsr";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

// Public on purpose: people who can no longer sign in (former members, people
// named in a post) must be able to reach the privacy team. Counted from the
// audit log as well, so the limits hold across server instances.
const PER_ADDRESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const PER_ADDRESS_MAX = 5;
const OVERALL_WINDOW_MS = 60 * 60 * 1000;
const OVERALL_MAX = 30;

const BUSY =
  "You've sent several messages already. We'll answer those first; try again tomorrow if you need to add something.";

async function overLimit(ipHash: string | null): Promise<boolean> {
  const fromContactForm = {
    action: "dsr.received",
    metadata: { path: ["channel"], equals: "contact_form" },
  };
  const [fromThisAddress, overall] = await Promise.all([
    ipHash
      ? db.auditEvent.count({
          where: {
            ...fromContactForm,
            ipHash,
            createdAt: { gte: new Date(Date.now() - PER_ADDRESS_WINDOW_MS) },
          },
        })
      : Promise.resolve(0),
    db.auditEvent.count({
      where: { ...fromContactForm, createdAt: { gte: new Date(Date.now() - OVERALL_WINDOW_MS) } },
    }),
  ]);
  return fromThisAddress >= PER_ADDRESS_MAX || overall >= OVERALL_MAX;
}

export async function sendPrivacyMessage(
  _previous: ContactState,
  formData: FormData
): Promise<ContactState> {
  const checked = validateContact({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    kind: formData.get("kind") ?? "",
    message: formData.get("message") ?? "",
  });

  // People never see this field; bots fill it. Answer as if it went through.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot) {
    return { status: "sent", email: checked.ok ? checked.data.email : "" };
  }

  if (!checked.ok) {
    return { status: "error", error: "Some fields need fixing.", fieldErrors: checked.fieldErrors };
  }

  const ip = clientIp(await headers()) ?? "unknown";
  const limit = await checkRateLimit("privacyContact", ip);
  if (!limit.allowed || (await overLimit(hashIp(ip)))) return { status: "error", error: BUSY };

  // A signed-in sender has already proved who they are; link the account.
  const user = await getCurrentUser();
  const { name, email, kind, message } = checked.data;
  const requestId = await openRequest({
    userId: user?.id ?? null,
    email,
    kind,
    notes: contactNotes(name, message),
    channel: "contact_form",
  });
  logger.info("Privacy message received", { requestId, kind, linked: Boolean(user) });

  return { status: "sent", email };
}
