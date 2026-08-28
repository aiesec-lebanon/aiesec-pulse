import { type NextRequest, NextResponse } from "next/server";

import { dueScheduledPostsQuery, publishDuePost } from "@/jobs/schedule";
import { db } from "@/lib/db";
import { testHooksEnabled } from "@/lib/test-hooks";

// No Inngest dev server runs in the e2e environment (playwright.config.ts has
// no such webServer), so this synchronously runs the same due-post logic the
// real cron invokes, letting a spec assert on the outcome without waiting on
// a real clock minute. The only test-only endpoint left in the product
// (sign-in has none), inert everywhere but a deliberately configured test
// deployment. 404, not 403: an endpoint answering "you are not allowed"
// confirms it exists.
export async function POST(request: NextRequest) {
  if (!testHooksEnabled()) return new NextResponse("Not found", { status: 404 });

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
