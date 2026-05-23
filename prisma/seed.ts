import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcryptjs from "bcryptjs";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const adapter = new PrismaPg(connectionString);
  const db = new PrismaClient({ adapter });

  const passwordHash = await bcryptjs.hash(password, 10);

  await db.admin.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash },
  });

  await db.$disconnect();

  console.log(`Admin seeded: ${email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
