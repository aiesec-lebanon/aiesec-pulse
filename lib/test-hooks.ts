import "server-only";

import { isProductionDeployment } from "@/lib/env";
import { logger } from "@/lib/logger";

// One switch for the whole test-only surface, so "are the backdoors open?"
// has one answer. Not an auth hook — the e2e suite authenticates via a real
// OAuth/GIS flow against a stub, so nothing under app/ or lib/ knows it
// exists. Requires PULSE_E2E_TEST_HOOKS=1 AND non-production; NODE_ENV
// doesn't count since `next start` sets it to "production" for any build.

export function testHooksEnabled(): boolean {
  if (process.env.PULSE_E2E_TEST_HOOKS !== "1") return false;

  if (isProductionDeployment()) {
    logger.error("A test-only endpoint was requested on the production deployment and refused", {
      severity: "CRITICAL",
      action: "Remove PULSE_E2E_TEST_HOOKS from the production environment immediately.",
    });
    return false;
  }

  return true;
}
