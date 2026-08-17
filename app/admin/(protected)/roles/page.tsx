import { GrantRoleForm } from "@/components/admin/GrantRoleForm";
import { type GrantRow, GrantsTable } from "@/components/admin/GrantsTable";
import { db } from "@/lib/db";
import { MANUAL_ONLY_ROLES, ROLE_DESCRIPTIONS, ROLE_NAMES } from "@/lib/rbac/catalogue";
import { requirePermission } from "@/lib/rbac/guards";
import { currentTermLabel } from "@/lib/term";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermission("admin.grant_role");
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [grants, entities, members] = await Promise.all([
    db.roleGrant.findMany({
      where: {
        source: "MANUAL",
        revokedAt: null,
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
    }),
    db.entity.findMany({
      where: { isActive: true },
      orderBy: { path: "asc" },
      take: 500,
      select: { id: true, name: true, path: true, kind: true },
    }),
    query
      ? db.user.findMany({
          where: {
            status: { not: "ERASED" },
            OR: [
              { fullName: { contains: query, mode: "insensitive" as const } },
              { email: { contains: query, mode: "insensitive" as const } },
            ],
          },
          orderBy: { fullName: "asc" },
          take: 25,
          select: {
            id: true,
            fullName: true,
            email: true,
            primaryEntity: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

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
      <h1 className="text-[24px] font-black text-[var(--foreground)]">Roles &amp; grants</h1>
      <p className="mt-1 max-w-[70ch] text-[15px] leading-[1.6] text-[var(--muted-foreground)]">
        Editors, moderators and platform admins are appointed here. Publishers are not — those
        rights come from EXPA positions and are re-derived every time the member signs in. Grants
        expire at the end of the current term ({currentTermLabel()}) unless renewed.
      </p>

      <section aria-labelledby="grant-heading" className="mt-8">
        <h2 id="grant-heading" className="mb-3 text-[16px] font-bold text-[var(--foreground)]">
          Grant a role
        </h2>
        <GrantRoleForm
          roles={MANUAL_ONLY_ROLES.filter((r) => r !== "break_glass_admin").map((key) => ({
            key,
            name: ROLE_NAMES[key],
            description: ROLE_DESCRIPTIONS[key],
            requiresEntity: key !== "platform_admin" && key !== "global_moderator",
          }))}
          entities={entities.map((e) => ({
            id: e.id,
            label: `${e.name} (${e.path})`,
            kind: e.kind,
          }))}
          members={members.map((m) => ({
            id: m.id,
            label: `${m.fullName}${m.email ? ` · ${m.email}` : ""}${
              m.primaryEntity ? ` · ${m.primaryEntity.name}` : ""
            }`,
          }))}
          searchQuery={query}
        />
      </section>

      <section aria-labelledby="grants-heading" className="mt-10">
        <h2 id="grants-heading" className="mb-3 text-[16px] font-bold text-[var(--foreground)]">
          Active grants
          <span className="ml-2 text-[14px] font-normal text-[var(--muted-foreground)]">
            ({rows.length})
          </span>
        </h2>
        {rows.length === 0 ? (
          <div className="aiesec-card px-8 py-12 text-center">
            <p className="text-[16px] text-[var(--muted-foreground)]">
              No manually granted roles yet.
            </p>
          </div>
        ) : (
          <GrantsTable rows={rows} />
        )}
      </section>
    </main>
  );
}
