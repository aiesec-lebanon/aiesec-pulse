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

// Migrations to a remote database go over TLS. Appended as text rather than
// rebuilt through URL, which could re-encode an already-encoded password.
const LOCAL_DB = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/i;
const withTls = (url: string | undefined): string | undefined => {
  if (!url || LOCAL_DB.test(url) || /[?&]sslmode=/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
};

// CLI needs the non-pooled connection; the runtime client uses the pooler.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: withTls(optional("DIRECT_URL") ?? optional("DATABASE_URL")),
    // Replays the migration chain into a throwaway database for the CI drift
    // gate. Absent locally, and must stay absent rather than blank.
    shadowDatabaseUrl: optional("SHADOW_DATABASE_URL"),
  },
});
