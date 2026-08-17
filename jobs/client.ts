import { EventSchemas, Inngest } from "inngest";

// Cron only triggers a job, never does the work — a serverless request timeout
// is not a job runtime. Jobs that do not exist yet are absent rather than
// stubbed: a registered no-op reports green.

type Events = {
  "org/entities.sync.requested": { data: { trigger: "cron" | "manual" } };
  "org/roles.sync.requested": { data: { trigger: "cron" | "manual"; activeSinceDays?: number } };
  "org/term.transition.requested": { data: { dryRun: boolean; termLabel?: string } };
  "privacy/retention.sweep.requested": { data: { dryRun: boolean } };
  "privacy/dsr.export.requested": { data: { requestId: string; userId: string } };
};

export const inngest = new Inngest({
  id: "aiesec-pulse",
  schemas: new EventSchemas().fromRecord<Events>(),
});

export const JOB_IDS = {
  syncEntities: "sync-entities",
  syncRoles: "sync-roles",
  termTransition: "term-transition",
  retentionSweep: "retention-sweep",
  dsrExport: "dsr-export",
} as const;
