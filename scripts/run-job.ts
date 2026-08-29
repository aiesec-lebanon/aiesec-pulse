import "dotenv/config";

import { writeFileSync } from "node:fs";

import { runDsrExport } from "@/jobs/retention";
import { runTermTransition } from "@/jobs/sync";

function usage(): never {
  console.error(
    [
      "Usage:",
      "  npm run job term-transition [--apply] [--term=26.27]   (defaults to dry-run)",
      "  npm run job dsr-export -- <requestId> <userId>",
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
    const outPath = `dsr-export-${requestId}.json`;
    writeFileSync(outPath, JSON.stringify(bundle, null, 2), "utf8");
    console.log(JSON.stringify(meta, null, 2));
    console.log(
      `\nBundle written to ${outPath} — deliver it to the subject, then delete the file.`
    );
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
