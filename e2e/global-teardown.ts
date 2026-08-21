import { runCleanup } from "./cleanup-runner";

/**
 * Runs once after the last test, whether the run passed or failed, and before
 * the web servers are stopped. Removes everything this run wrote and puts the
 * feature flags back the way it found them.
 *
 * Set PULSE_E2E_KEEP_DATA=1 to keep the rows and inspect them after a failure;
 * the next run's globalSetup clears them.
 */
export default async function globalTeardown(): Promise<void> {
  await runCleanup("clean");
}
