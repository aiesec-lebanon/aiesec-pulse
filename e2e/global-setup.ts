import { runCleanup } from "./cleanup-runner";

/**
 * Runs once, after the web servers are up and before the first test.
 *
 * A run that was interrupted — Ctrl+C, a crashed worker, a machine that went to
 * sleep — never reaches globalTeardown, so its rows would otherwise be
 * permanent. This makes every run start from the same empty state regardless of
 * how the last one ended, which is the property the ranked feed and the entity
 * typeahead quietly depend on.
 */
export default async function globalSetup(): Promise<void> {
  await runCleanup("prepare");
}
