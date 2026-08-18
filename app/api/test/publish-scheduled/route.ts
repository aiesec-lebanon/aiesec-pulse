import { type NextRequest, NextResponse } from "next/server";

import { dueScheduledPostsQuery, publishDuePost } from "@/jobs/schedule";
import { mockAuthEnabled } from "@/lib/auth/mock-oauth";
import { db } from "@/lib/db";

// No Inngest dev server runs in the e2e environment (playwright.config.ts has
// no such webServer), so this runs the same due-post logic the real cron
// invokes, synchronously, so a spec can assert on the outcome without
// waiting on a real clock minute. Gated by the same test-only flag as
// /api/auth/mock — there is one "test backdoors are open" switch, not two —
// so this is inert everywhere but a deliberately-configured test deployment.
export async function POST(request: NextRequest) {
  if (!mockAuthEnabled()) return new NextResponse("Not found", { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { asOf?: string };
  const asOf = body.asOf ? new Date(body.asOf) : new Date();
  if (Number.isNaN(asOf.getTime())) {
    return NextResponse.json({ error: "asOf must be a valid ISO instant" }, { status: 400 });
  }

  const due = await db.post.findMany(dueScheduledPostsQuery(asOf));
  let published = 0;
  for (const post of due) {
    if (await publishDuePost(post)) published++;
  }

  return NextResponse.json({ due: due.length, published });
}
