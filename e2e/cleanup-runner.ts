import { spawn } from "node:child_process";
import { resolve } from "node:path";

/**
 * Starts `e2e/cleanup.ts` in its own process — required, not stylistic:
 * Playwright transpiles hooks to CommonJS, but the generated Prisma client
 * is ESM using `import.meta`, which fails to load directly from a hook.
 */

export type CleanupMode = "prepare" | "clean";

// `__dirname`, not `import.meta.url`: this module is loaded by the same
// CommonJS transform described above, where `import.meta` is unavailable.
const REPO_ROOT = resolve(__dirname, "..");

export function runCleanup(mode: CleanupMode): Promise<void> {
  return new Promise((fulfil, reject) => {
    // shell:true because npm is a .cmd on Windows; a single command string
    // (not argv) avoids Node's DEP0190. Every word here is a literal —
    // nothing user-supplied reaches the shell.
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
