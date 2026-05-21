// Idempotent admin bootstrap. Run via: npm run seed
// Reads ADMIN_EMAIL and ADMIN_PASSWORD from env, bcrypts the password,
// and upserts an Admin row. Safe to re-run.
// TODO: implement seeding logic once lib/db.ts Prisma client is wired up.

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment");
  }

  console.log(`Seeding admin: ${email}`);
  // TODO: import db from lib/db, import bcryptjs, hash password, db.admin.upsert
  console.log("Seed complete (implementation pending).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
