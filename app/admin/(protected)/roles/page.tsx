import { type MatrixCell, PermissionMatrix } from "@/components/admin/PermissionMatrix";
import { PageHeader } from "@/components/ui/PageHeader";
import { ROLE_DESCRIPTIONS, ROLE_KEYS, ROLE_NAMES } from "@/lib/rbac/catalogue";
import { requireAdmin } from "@/lib/rbac/guards";
import { permissionMatrix } from "@/lib/rbac/matrix";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  await requireAdmin();

  const matrix = await permissionMatrix();
  const allowed = ROLE_KEYS.flatMap((role) =>
    matrix[role].map((permission): MatrixCell => `${role}:${permission}`)
  );

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-8 sm:px-6">
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Permissions" }]}
        title="Permissions"
        standfirst="Who holds which position is not decided here. Every position is read from the member's current EXPA positions and re-derived each time they sign in. What is decided here is what each position may do — a change takes effect for everyone within a minute, with no deploy."
        bordered={false}
      />

      <section aria-labelledby="matrix-heading" className="mt-8">
        <h2
          id="matrix-heading"
          className="mb-3 text-[16px] font-bold text-[color:var(--foreground)]"
        >
          Position classes
        </h2>
        <PermissionMatrix allowed={allowed} />
      </section>

      <section aria-labelledby="classes-heading" className="mt-10">
        <h2
          id="classes-heading"
          className="mb-3 text-[16px] font-bold text-[color:var(--foreground)]"
        >
          What each class is
        </h2>
        <dl className="flex flex-col gap-2">
          {ROLE_KEYS.map((role) => (
            <div
              key={role}
              className="aiesec-card flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4"
            >
              <dt className="text-[15px] font-bold text-[color:var(--foreground)]">
                {ROLE_NAMES[role]}
              </dt>
              <dd className="min-w-[240px] flex-1 text-[14px] leading-[1.6] text-[color:var(--muted-foreground)]">
                {ROLE_DESCRIPTIONS[role]}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
