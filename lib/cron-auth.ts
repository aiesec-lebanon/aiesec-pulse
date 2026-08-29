import "server-only";

import { env } from "@/lib/env";

export function isAuthorisedCronRequest(request: Request): boolean {
  const header = request.headers.get("authorization");
  return header === `Bearer ${env.CRON_SECRET}`;
}
