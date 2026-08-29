import { NextResponse } from "next/server";

import { runSyncRoles } from "@/jobs/sync";
import { isAuthorisedCronRequest } from "@/lib/cron-auth";

// Vercel Cron, daily at 02:00 — see vercel.json.
export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await runSyncRoles();
  return NextResponse.json(result);
}
