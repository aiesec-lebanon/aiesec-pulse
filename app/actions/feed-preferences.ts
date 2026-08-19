"use server";

import { cookies } from "next/headers";

import { FEED_MODE_COOKIE, type FeedMode } from "@/lib/feed-mode";
import { requireSession } from "@/lib/rbac/guards";

// A display preference, not session/handshake state — httpOnly + sameSite=lax
// + a year-long maxAge mirrors lib/auth/session.ts's COOKIE_OPTIONS exactly,
// since no client script ever needs to read this cookie itself.
export async function setFeedMode(mode: FeedMode): Promise<void> {
  await requireSession();

  const store = await cookies();
  store.set(FEED_MODE_COOKIE, mode, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}
