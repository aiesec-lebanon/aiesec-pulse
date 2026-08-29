import { PublishingActivity } from "@/components/insights/PublishingActivity";
import { requirePermission } from "@/lib/rbac/guards";
import { resolveScopeFilter } from "@/lib/rbac/scope-filter";

export const dynamic = "force-dynamic";

export const metadata = { title: "Publishing activity · AIESEC Pulse" };

// Same view as /admin/activity, scoped by position not credential:
// resolveScopeFilter narrows it to entities where the user holds
// analytics.view_entity (an MCVP sees only their MC's subtree).
export default async function InsightsPage() {
  const user = await requirePermission("analytics.view_entity");
  const scope = await resolveScopeFilter(user, "analytics.view_entity");

  return (
    <PublishingActivity
      scope={scope}
      breadcrumb={[{ href: "/feed", label: "Feed" }, { label: "Insights" }]}
      variant="hairline"
    />
  );
}
