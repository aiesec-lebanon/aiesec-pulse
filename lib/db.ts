import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/app/generated/prisma/client";

// Bumped by `prisma generate`. Changing it forces the dev-mode singleton to be
// recreated, which is necessary after a migration adds models.
const CLIENT_ID = "20260527200507";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg(connectionString);
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

// Serializable is what stops two submissions racing at `used = max - 1` from
// both publishing. The retry is what makes it usable: Postgres does not block
// conflicting transactions, it aborts one at commit, so without it the loser
// surfaces as a 500 to a blameless publisher.
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
  fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>
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
