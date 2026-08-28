import { type FlagRow, FlagsTable } from "@/components/admin/FlagsTable";
import { PageHeader } from "@/components/ui/PageHeader";
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

  // Show every seeded key even without a row, so a flag added before a
  // reseed still appears (off) instead of vanishing.
  const rows: FlagRow[] = FLAG_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      enabled: row?.enabled ?? false,
      updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
    };
  });

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 pb-24 pt-8 sm:px-6">
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Flags" }]}
        title="Feature flags"
        standfirst="Every feature ships behind a flag, off by default. Toggling one here takes effect for all users within about 15 seconds — no deploy required."
        bordered={false}
      />

      <section aria-labelledby="flags-heading" className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="flags-heading" className="text-[16px] font-bold text-[color:var(--foreground)]">
            Flags
          </h2>
          <p className="pulse-label">{rows.length} flags</p>
        </div>
        <FlagsTable rows={rows} />
      </section>
    </main>
  );
}
