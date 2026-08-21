import "server-only";

import { isProductionDeployment } from "@/lib/env";
import { logger } from "@/lib/logger";

// One switch for the whole of the test-only surface, so "are the backdoors
// open?" has a single answer rather than one per endpoint.
//
// This is deliberately not an authentication hook. Sign-in has no test path at
// all any more: the e2e suite authenticates by pointing the app's AIESEC
// endpoints at a stub and running the real OAuth and GIS flow against it, which
// is why nothing under `app/` or `lib/` knows the suite exists.
//
// Requires both PULSE_E2E_TEST_HOOKS=1 and a non-production deployment. NODE_ENV
// is deliberately not one of them: `next start` sets it to "production" for
// every built app, including the one under test.

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
