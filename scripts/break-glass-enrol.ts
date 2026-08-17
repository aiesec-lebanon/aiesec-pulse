import "dotenv/config";

import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

import { PrismaPg } from "@prisma/adapter-pg";
import bcryptjs from "bcryptjs";
import { authenticator } from "otplib";

import { PrismaClient } from "../app/generated/prisma/client";

// Run interactively on a trusted machine. The generated password is printed
// once and never stored in plaintext.

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL (or DIRECT_URL) is not set");

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be set (32+ characters) to encrypt the TOTP secret");
  }

  const db = new PrismaClient({ adapter: new PrismaPg(connectionString) });
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log("Break-glass enrolment");
    console.log("─".repeat(60));
    console.log("This account can administer Pulse when AIESEC sign-in is unavailable.");
    console.log("Every use raises a CRITICAL alert and is written to the audit log.");
    console.log();

    const email = (await rl.question("Email for this break-glass account: ")).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That is not a valid email");

    const holder = (await rl.question("Named holder (recorded for the quarterly review): ")).trim();
    if (holder.length < 2) throw new Error("Record who holds this credential");

    // Generated rather than chosen: used once a year at most, which is exactly
    // where a human-chosen password is weakest.
    const password = randomBytes(24).toString("base64url");
    const passwordHash = await bcryptjs.hash(password, 12);
    const totpSecret = authenticator.generateSecret();

    // Lazy import so the module's server-only guard does not fire in a script.
    const { encryptToBytes } = await import("../lib/crypto");

    await db.breakGlassAdmin.upsert({
      where: { email },
      update: {
        passwordHash,
        totpSecretEnc: new Uint8Array(encryptToBytes(totpSecret)),
        isActive: true,
      },
      create: {
        email,
        passwordHash,
        totpSecretEnc: new Uint8Array(encryptToBytes(totpSecret)),
        isActive: true,
      },
    });

    const uri = authenticator.keyuri(email, "AIESEC Pulse (break-glass)", totpSecret);

    console.log();
    console.log("─".repeat(60));
    console.log("Enrolled. This output appears ONCE — store it in the password manager now.");
    console.log();
    console.log(`  Holder    ${holder}`);
    console.log(`  Email     ${email}`);
    console.log(`  Password  ${password}`);
    console.log(`  TOTP URI  ${uri}`);
    console.log();
    console.log("Add the TOTP URI to an authenticator app, then verify by signing in at");
    console.log("  /break-glass");
    console.log();
    console.log("Record the holder and enrolment date with your platform team, and");
    console.log("add the next quarterly review to the team calendar.");
    console.log("─".repeat(60));
  } finally {
    rl.close();
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
