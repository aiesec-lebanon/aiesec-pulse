import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";

import { PrismaClient } from "@/app/generated/prisma/client";

// Bumped by `prisma generate`. Changing it forces the dev-mode singleton to be
// recreated, which is necessary after a migration adds models.
const CLIENT_ID = "20260527200507";

/**
 * `pg.Pool.max` defaults to 10 — right for Vercel (~1 req/instance;
 * production stays unchanged). Wrong for one long-lived `next start`
 * process under concurrent traffic (e.g. parallel Playwright workers),
 * where every request queues behind those 10 slots — `DATABASE_POOL_MAX`
 * raises it for that shape; the Supabase pooler multiplexes it back down.
 */
const DEFAULT_POOL_MAX = 10;

function poolMax(): number {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_POOL_MAX;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalDatabase(connectionString: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(connectionString).hostname);
  } catch {
    return false;
  }
}

/**
 * node-postgres sends nothing over TLS unless told to. Remote connections are
 * always encrypted; the server certificate is verified once DATABASE_CA_CERT
 * (Supabase dashboard → Database → SSL) is set. An explicit `sslmode` in the
 * URL is the operator's choice and is left to pg.
 */
export function sslOption(connectionString: string): PoolConfig["ssl"] {
  if (/[?&]sslmode=/i.test(connectionString)) return undefined;

  const ca = process.env.DATABASE_CA_CERT?.trim();
  // Env UIs often store a PEM on one line with literal "\n" separators.
  if (ca) return { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true };

  if (isLocalDatabase(connectionString)) return undefined;

  if (process.env.NODE_ENV === "production") {
    console.warn(
      JSON.stringify({
        level: "warn",
        time: new Date().toISOString(),
        message: "Database connection is encrypted but the server certificate is not verified",
        remedy: "Set DATABASE_CA_CERT to the Supabase CA certificate.",
      })
    );
  }
  return { rejectUnauthorized: false };
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({
    connectionString,
    max: poolMax(),
    ssl: sslOption(connectionString),
  });
  return new PrismaClient({ adapter });
}

type PrismaGlobal = { prisma?: PrismaClient; prismaClientId?: string };
const globalForPrisma = globalThis as unknown as PrismaGlobal;

if (process.env.NODE_ENV !== "production" && globalForPrisma.prismaClientId !== CLIENT_ID) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaClientId = CLIENT_ID;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Serializable stops two submissions racing at `used = max - 1` from both
// publishing. Postgres aborts the loser at commit rather than blocking it,
// so the retry is what keeps that loser from surfacing as a blameless 500.
const SERIALIZATION_FAILURE = "40001";
const DEADLOCK_DETECTED = "40P01";
const MAX_ATTEMPTS = 5;

function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: string; meta?: { code?: unknown }; message?: string };
  if (candidate.code === "P2034") return true;
  if (
    candidate.meta?.code === SERIALIZATION_FAILURE ||
    candidate.meta?.code === DEADLOCK_DETECTED
  ) {
    return true;
  }

  const message = candidate.message ?? "";
  return (
    message.includes("TransactionWriteConflict") ||
    message.includes("write conflict") ||
    message.includes("deadlock")
  );
}

export async function serializableTransaction<T>(
  fn: (_tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isRetryableTransactionError(error)) throw error;
      lastError = error;

      if (attempt < MAX_ATTEMPTS) {
        const backoff = 20 * 2 ** (attempt - 1);
        await new Promise((resolve) =>
          setTimeout(resolve, backoff + Math.random() * backoff * 0.5)
        );
      }
    }
  }

  throw lastError;
}
