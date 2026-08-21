import { spawn } from "node:child_process";
import { resolve } from "node:path";

/**
 * Starts `e2e/cleanup.ts` in its own process.
 *
 * The indirection is not a preference. Playwright transpiles globalSetup and
 * globalTeardown to CommonJS, and the generated Prisma client is ESM that uses
 * `import.meta` — importing it from a Playwright hook fails at load with
 * "Cannot use 'import.meta' outside a module". Running the cleanup under `tsx`,
 * the same way `npm run seed` runs the seed, sidesteps the loader entirely and
 * has the side benefit of making the cleanup runnable by hand.
 */

export type CleanupMode = "prepare" | "clean";

// `__dirname`, not `import.meta.url`: this module is loaded by the same
// CommonJS transform described above, where `import.meta` is unavailable.
const REPO_ROOT = resolve(__dirname, "..");

export function runCleanup(mode: CleanupMode): Promise<void> {
  return new Promise((fulfil, reject) => {
    // `shell: true` because npm is a .cmd on Windows, and one command string
    // rather than an argv array because passing both trips Node's DEP0190. Every
    // word here is a literal — nothing user-supplied reaches the shell — and the
    // working directory, which may well contain spaces, is passed as an option
    // instead of being interpolated into the command.
    const child = spawn(`npm run --silent e2e:cleanup -- ${mode}`, {
      cwd: REPO_ROOT,
      shell: true,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return fulfil();
      reject(new Error(`e2e cleanup (${mode}) exited with code ${code}.`));
    });
  });
}
