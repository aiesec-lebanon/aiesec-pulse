import dotenv from "dotenv";
// Next.js reads .env.local over .env; mirror that for Prisma CLI.
dotenv.config({ path: ".env.local", override: true });
dotenv.config(); // .env as fallback

import { defineConfig } from "prisma/config";

// DIRECT_URL (non-pooled) is used by Prisma CLI (prisma migrate / db push).
// DATABASE_URL (PgBouncer pooler) is used by PrismaClient at runtime (lib/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
