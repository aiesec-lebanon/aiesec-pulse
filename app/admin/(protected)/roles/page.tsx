import { type GrantRow, GrantsTable } from "@/components/admin/GrantsTable";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guards";
import { currentTermLabel } from "@/lib/term";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermission("admin.configure_roles");
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const grants = await db.roleGrant.findMany({
    where: {
      revokedAt: null,
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      ...(query
        ? {
            user: {
              OR: [
                { fullName: { contains: query, mode: "insensitive" as const } },
                { email: { contains: query, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      termLabel: true,
      startsAt: true,
      endsAt: true,
      user: { select: { id: true, fullName: true, email: true } },
      role: { select: { key: true, name: true } },
      scope: { select: { name: true, path: true } },
    },
  });

  const rows: GrantRow[] = grants.map((g) => ({
    id: g.id,
    memberName: g.user.fullName,
    memberEmail: g.user.email,
    roleKey: g.role.key,
    roleName: g.role.name,
    scopeName: g.scope?.name ?? "Global",
    termLabel: g.termLabel,
    startsAt: g.startsAt.toISOString(),
    endsAt: g.endsAt?.toISOString() ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
      <h1 className="text-[24px] font-black text-[color:var(--foreground)]">Positions</h1>
      <p className="mt-1 max-w-[70ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
        Nobody is appointed here. Every position below was read from the member&apos;s current EXPA
        positions and is re-derived each time they sign in — revoking one is a containment measure
        for a grant that looks wrong, not a way to change who holds what. Positions expire at the
        end of the current term ({currentTermLabel()}) unless EXPA still lists them.
      </p>

      {/* Server-rendered, so the page still filters with scripting disabled. */}
      <form method="get" action="/admin/roles" className="mt-6 flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1">
          <label
            htmlFor="grant-search"
            className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
          >
            Find a member
          </label>
          <input
            id="grant-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Name or email"
            className="min-h-[36px] w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[14px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
          />
        </div>
        <button type="submit" className="aiesec-btn-secondary min-h-[36px]">
          Search
        </button>
      </form>

      <section aria-labelledby="grants-heading" className="mt-10">
        <h2
          id="grants-heading"
          className="mb-3 text-[16px] font-bold text-[color:var(--foreground)]"
        >
          Active positions
          <span className="ml-2 text-[14px] font-normal text-[color:var(--muted-foreground)]">
            ({rows.length})
          </span>
        </h2>
        {rows.length === 0 ? (
          <div className="aiesec-card px-8 py-12 text-center">
            <p className="text-[16px] text-[color:var(--muted-foreground)]">
              {query ? "No positions match that search." : "No active positions yet."}
            </p>
          </div>
        ) : (
          <GrantsTable rows={rows} />
        )}
      </section>
    </main>
  );
}
