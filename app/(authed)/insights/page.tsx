import { PublishingActivity } from "@/components/insights/PublishingActivity";
import { requirePermission } from "@/lib/rbac/guards";
import { resolveScopeFilter } from "@/lib/rbac/scope-filter";

export const dynamic = "force-dynamic";

export const metadata = { title: "Publishing activity · AIESEC Pulse" };

/**
 * An officer's own publishing numbers, at `/insights`.
 *
 * The same view a platform administrator sees at `/admin/activity`, scoped by
 * the position instead of by the credential — `resolveScopeFilter` narrows it
 * to the entities where this member actually holds `analytics.view_entity`, so
 * an MCVP sees their MC's subtree and nothing above it.
 *
 * Under `/admin` this page had to branch on which of two identities was
 * present, and it put an officer reading their own entity's numbers behind a
 * URL that told them they were administering the platform. One guard per
 * route, one shell per audience, one implementation of the page.
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
