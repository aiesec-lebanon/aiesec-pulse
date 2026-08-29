import { NextResponse } from "next/server";

import { runSyncEntities } from "@/jobs/sync";
import { isAuthorisedCronRequest } from "@/lib/cron-auth";

// Vercel Cron, weekly Monday 03:00 — see vercel.json.
export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await runSyncEntities();
  return NextResponse.json(result);
}
