import "server-only";

import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";

// Constant-time, so response timing cannot be used to guess the secret.
export function isAuthorisedCronRequest(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${env.CRON_SECRET}`);
}
