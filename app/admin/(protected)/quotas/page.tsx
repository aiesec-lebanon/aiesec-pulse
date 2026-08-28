import { PostLevel, QuotaPeriod, ScopeType } from "@/app/generated/prisma/enums";
import { QuotaOverrideForm } from "@/components/admin/QuotaOverrideForm";
import { type QuotaGroup, QuotaTable } from "@/components/admin/QuotaTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { rolesSpendingAt } from "@/lib/quota";
import type { RoleKey } from "@/lib/rbac/catalogue";
import { requireAdmin } from "@/lib/rbac/guards";
import { permissionMatrix } from "@/lib/rbac/matrix";

export const dynamic = "force-dynamic";

const LEVELS = [PostLevel.LOCAL, PostLevel.NETWORK] as const;

const LEVEL_LABELS: Record<PostLevel, string> = {
  LOCAL: "Publishing — how many posts a class may publish into its own MC",
  NETWORK: "Promotion — how many of those an MC may put in front of the whole network",
};

export default async function AdminQuotasPage() {
  await requireAdmin();

  // An inactive row enforces nothing, so it is not shown as a budget — the
  // class reads as unset, which is what a publish would find.
  const [matrix, policies] = await Promise.all([
    permissionMatrix(),
    db.quotaPolicy.findMany({
      where: { isActive: true },
      select: {
        id: true,
        scopeType: true,
        entityId: true,
        roleKey: true,
        postLevel: true,
        period: true,
        maxPosts: true,
        entity: { select: { id: true, name: true, tag: true } },
      },
    }),
  ]);

  const rolesByLevel = {
    [PostLevel.LOCAL]: rolesSpendingAt(PostLevel.LOCAL, matrix),
    [PostLevel.NETWORK]: rolesSpendingAt(PostLevel.NETWORK, matrix),
  };

  const defaults = policies.filter((p) => p.scopeType === ScopeType.GLOBAL && !p.entityId);
  const defaultGroups: QuotaGroup[] = LEVELS.map((level) => ({
    level,
    label: LEVEL_LABELS[level],
    rows: rolesByLevel[level].map((roleKey) => {
      const policy = defaults.find((p) => p.roleKey === roleKey && p.postLevel === level);
      return {
        policyId: policy?.id ?? null,
        roleKey,
        postLevel: level,
        period: policy?.period ?? QuotaPeriod.ISO_WEEK,
        maxPosts: policy?.maxPosts ?? 0,
      };
    }),
  }));

  const overrides = new Map<
    string,
    { name: string; tag: string | null; groups: Map<PostLevel, QuotaGroup> }
  >();
  for (const policy of policies) {
    if (policy.scopeType !== ScopeType.ENTITY || !policy.entity) continue;
    const mc =
      overrides.get(policy.entity.id) ??
      (() => {
        const created = {
          name: policy.entity.name,
          tag: policy.entity.tag,
          groups: new Map<PostLevel, QuotaGroup>(),
        };
        overrides.set(policy.entity.id, created);
        return created;
      })();

    const group =
      mc.groups.get(policy.postLevel) ??
      (() => {
        const created: QuotaGroup = {
          level: policy.postLevel,
          label: LEVEL_LABELS[policy.postLevel],
          rows: [],
        };
        mc.groups.set(policy.postLevel, created);
        return created;
      })();

    group.rows.push({
      policyId: policy.id,
      roleKey: policy.roleKey as RoleKey,
      postLevel: policy.postLevel,
      period: policy.period,
      maxPosts: policy.maxPosts,
    });
  }

  const overrideEntries = [...overrides.entries()].sort((a, b) =>
    a[1].name.localeCompare(b[1].name)
  );

  return (
    <main className="mx-auto w-full max-w-[1000px] px-4 pb-24 pt-8 sm:px-6">
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Quotas" }]}
        title="Publishing quotas"
        standfirst="Two budgets, both counted per period and both live on the next post — no deploy, no cache to wait out. Publishing is how many posts a class may put in front of its own MC; anything over it goes to that MC's approval queue. Promotion is how many of those an MC may push to the whole network, counted across the MC rather than per officer, and never refunded by returning a post to local."
        bordered={false}
      />

      <section aria-labelledby="defaults-heading" className="mt-8">
        <h2
          id="defaults-heading"
          className="mb-1 text-[16px] font-bold text-[color:var(--foreground)]"
        >
          Network-wide defaults
        </h2>
        <p className="mb-3 max-w-[70ch] text-[14px] leading-[1.6] text-[color:var(--muted-foreground)]">
          What every entity gets unless it has an override below.
        </p>
        <QuotaTable
          caption="Network-wide publishing and promotion budgets"
          groups={defaultGroups}
        />
      </section>

      <section aria-labelledby="overrides-heading" className="mt-10">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2
            id="overrides-heading"
            className="text-[16px] font-bold text-[color:var(--foreground)]"
          >
            Per-MC overrides
          </h2>
          <p className="pulse-label">{overrideEntries.length} configured</p>
        </div>
        <p className="mb-3 max-w-[70ch] text-[14px] leading-[1.6] text-[color:var(--muted-foreground)]">
          The nearest scope wins, so an override replaces the default for that MC — and, for the
          publishing budget, for every LC beneath it. Removing one returns the MC to the default.
        </p>

        {overrideEntries.length === 0 ? (
          <EmptyState
            eyebrow="No overrides"
            heading="Every entity is on the defaults."
            body="No MC has a bespoke allowance yet. Give one an override below."
          />
        ) : (
          <div className="flex flex-col gap-6">
            {overrideEntries.map(([entityId, mc]) => (
              <div key={entityId}>
                <h3 className="mb-2 break-words text-[15px] font-bold text-[color:var(--foreground)]">
                  {mc.name}
                  {mc.tag && (
                    <span className="ml-2 text-[13px] font-medium text-[color:var(--muted-foreground)]">
                      {mc.tag}
                    </span>
                  )}
                </h3>
                <QuotaTable
                  caption={`Publishing and promotion budgets for ${mc.name}`}
                  groups={[...mc.groups.values()]}
                  entityId={entityId}
                  removable
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="add-override-heading" className="mt-10">
        <h2
          id="add-override-heading"
          className="mb-3 text-[16px] font-bold text-[color:var(--foreground)]"
        >
          Give one MC its own allowance
        </h2>
        <QuotaOverrideForm rolesByLevel={rolesByLevel} />
      </section>
    </main>
  );
}
