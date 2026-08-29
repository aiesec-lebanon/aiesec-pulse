import { runCleanup } from "./cleanup-runner";

/**
 * Runs once after the last test (pass or fail), before servers stop.
 * Removes this run's rows and restores feature flags. Set
 * PULSE_E2E_KEEP_DATA=1 to inspect data after a failure; next setup clears it.
 */
export default async function globalTeardown(): Promise<void> {
  await runCleanup("clean");
}
