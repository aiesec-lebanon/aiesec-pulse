import { NextResponse } from "next/server";

import { runPublishScheduled } from "@/jobs/schedule";
import { isAuthorisedCronRequest } from "@/lib/cron-auth";

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await runPublishScheduled();
  return NextResponse.json(result);
}
