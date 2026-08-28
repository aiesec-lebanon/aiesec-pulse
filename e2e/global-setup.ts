import { runCleanup } from "./cleanup-runner";

/**
 * Runs once before the first test. An interrupted prior run (Ctrl+C, crash)
 * never reaches globalTeardown, so this guarantees a clean-slate start —
 * which the ranked feed and entity typeahead quietly depend on.
 */
export default async function globalSetup(): Promise<void> {
  await runCleanup("prepare");
}
