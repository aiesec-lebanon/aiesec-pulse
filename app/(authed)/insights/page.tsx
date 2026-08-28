import { PublishingActivity } from "@/components/insights/PublishingActivity";
import { requirePermission } from "@/lib/rbac/guards";
import { resolveScopeFilter } from "@/lib/rbac/scope-filter";

export const dynamic = "force-dynamic";

export const metadata = { title: "Publishing activity · AIESEC Pulse" };

/**
 * An officer's own publishing numbers, at `/insights`.
 *
 * The same view an admin sees at `/admin/activity`, scoped by position not
 * credential: `resolveScopeFilter` narrows it to entities where this member
 * holds `analytics.view_entity` — an MCVP sees only their MC's subtree.
 *
 * Under `/admin` this page branched on which of two identities was present,
 * putting an officer reading their own entity's numbers behind a URL implying
 * they administered the platform. Now: one guard per route, one shell per
 * audience, one implementation.
 */
export default async function InsightsPage() {
  const user = await requirePermission("analytics.view_entity");
  const scope = await resolveScopeFilter(user, "analytics.view_entity");

  return (
    <PublishingActivity
      scope={scope}
      breadcrumb={[{ href: "/feed", label: "Feed" }, { label: "Insights" }]}
    />
  );
}
