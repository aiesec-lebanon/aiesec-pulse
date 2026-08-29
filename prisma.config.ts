import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config(); // .env as fallback

import { defineConfig } from "prisma/config";

// A blank .env var loads as "", so `??` won't fall back — Prisma then
// reports a confusing P1013 for what's really just an empty value.
const optional = (name: string): string | undefined => {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : undefined;
};

// CLI needs the non-pooled connection; the runtime client uses the pooler.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: optional("DIRECT_URL") ?? optional("DATABASE_URL"),
    // Replays the migration chain into a throwaway database for the CI drift
    // gate. Absent locally, and must stay absent rather than blank.
    shadowDatabaseUrl: optional("SHADOW_DATABASE_URL"),
  },
});
