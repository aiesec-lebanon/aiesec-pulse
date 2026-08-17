import { serve } from "inngest/next";

import { inngest } from "@/jobs/client";
import { dsrExport, retentionSweep } from "@/jobs/retention";
import { syncEntities, syncRoles, termTransition } from "@/jobs/sync";

// Authenticated by INNGEST_SIGNING_KEY, so it sits outside the session guard.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncEntities, syncRoles, termTransition, retentionSweep, dsrExport],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

export const maxDuration = 300;
