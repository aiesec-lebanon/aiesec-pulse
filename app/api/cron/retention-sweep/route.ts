import { NextResponse } from "next/server";

import { runRetentionSweep } from "@/jobs/retention";
import { isAuthorisedCronRequest } from "@/lib/cron-auth";

// Vercel Cron, daily at 03:30 — see vercel.json.
export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await runRetentionSweep();
  return NextResponse.json(result);
}
