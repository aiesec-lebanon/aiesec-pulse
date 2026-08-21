import { type FlagRow, FlagsTable } from "@/components/admin/FlagsTable";
import { db } from "@/lib/db";
import { FLAG_KEYS } from "@/lib/flags";
import { requireAdmin } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

export default async function AdminFlagsPage() {
  await requireAdmin();

  const stored = await db.featureFlag.findMany({
    where: { key: { in: [...FLAG_KEYS] } },
    select: { key: true, enabled: true, updatedAt: true },
  });
  const byKey = new Map(stored.map((row) => [row.key, row]));

  // Every seeded key is shown even if the row is somehow missing, so a
  // deploy that added a flag key but hasn't reseeded yet still shows the
  // toggle instead of hiding it.
  const rows: FlagRow[] = FLAG_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      enabled: row?.enabled ?? false,
      updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
    };
  });

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
      <h1 className="text-[24px] font-black text-[color:var(--foreground)]">Feature flags</h1>
      <p className="mt-1 max-w-[70ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
        Every feature ships behind a flag, off by default. Toggling one here takes effect for all
        users within about 15 seconds — no deploy required.
      </p>

      <section aria-labelledby="flags-heading" className="mt-8">
        <h2
          id="flags-heading"
          className="mb-3 text-[16px] font-bold text-[color:var(--foreground)]"
        >
          Flags
          <span className="ml-2 text-[14px] font-normal text-[color:var(--muted-foreground)]">
            ({rows.length})
          </span>
        </h2>
        <FlagsTable rows={rows} />
      </section>
    </main>
  );
}
