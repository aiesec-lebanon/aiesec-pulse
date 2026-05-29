import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// CLIENT_GENERATION_ID is replaced at build time by the prisma generate step.
// Changing this value forces the dev-mode global singleton to be recreated,
// which is necessary after schema migrations add new models.
const CLIENT_ID = "20260527200507";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg(connectionString);
  return new PrismaClient({ adapter });
}

type PrismaGlobal = { prisma?: PrismaClient; prismaClientId?: string };
const globalForPrisma = globalThis as unknown as PrismaGlobal;

// In dev, invalidate the cached client whenever the generated client changes
// (identified by CLIENT_ID stamped at generate time).
if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prismaClientId !== CLIENT_ID
) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaClientId = CLIENT_ID;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
