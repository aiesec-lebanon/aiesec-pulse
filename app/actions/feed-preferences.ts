"use server";

import { cookies } from "next/headers";

import { FEED_MODE_COOKIE, type FeedMode } from "@/lib/feed-mode";
import { requireSession } from "@/lib/rbac/guards";

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
