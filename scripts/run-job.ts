import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runMediaMigration } from "@/jobs/media";
import { runDsrExport } from "@/jobs/retention";
import { runTermTransition } from "@/jobs/sync";

function usage(): never {
  console.error(
    [
      "Usage:",
      "  npm run job term-transition [--apply] [--term=26.27]   (defaults to dry-run)",
      "  npm run job dsr-export -- <requestId> <userId>",
      "  npm run job media-migrate [--apply]                    (defaults to dry-run)",
    ].join("\n")
  );
  process.exit(1);
}

async function main() {
  const [job, ...rest] = process.argv.slice(2);

  if (job === "term-transition") {
    const apply = rest.includes("--apply");
    const termArg = rest.find((a) => a.startsWith("--term="));
    const termLabel = termArg?.slice("--term=".length);

    const result = await runTermTransition({ dryRun: !apply, termLabel });
    console.log(JSON.stringify(result, null, 2));
    if (!apply) {
      console.log(
        "\nDry run only — nothing was changed. Re-run with --apply to expire these grants."
      );
    }
    return;
  }

  if (job === "dsr-export") {
    const [requestId, userId] = rest;
    if (!requestId || !userId) usage();

    const { bundle, ...meta } = await runDsrExport(requestId, userId);
    // Outside the repository, readable by this OS user only, so a personal-data
    // bundle can never be committed or picked up by another account.
    const dir = join(tmpdir(), "pulse-dsr-exports");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const outPath = join(dir, `dsr-export-${requestId}.json`);
    writeFileSync(outPath, JSON.stringify(bundle, null, 2), { encoding: "utf8", mode: 0o600 });
    console.log(JSON.stringify(meta, null, 2));
    console.log(
      `\nBundle written to ${outPath}\nDeliver it to the subject over a secure channel, then delete the file.`
    );
    return;
  }

  if (job === "media-migrate") {
    const apply = rest.includes("--apply");
    const summary = await runMediaMigration(apply);
    console.log(JSON.stringify(summary, null, 2));
    if (!apply) {
      console.log("\nDry run only — nothing was changed. Re-run with --apply to migrate.");
    }
    return;
  }

  usage();
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("[run-job] failed:", error);
    process.exit(1);
  });
