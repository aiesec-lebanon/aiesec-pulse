import { PublishingActivity } from "@/components/insights/PublishingActivity";
import { requireAdmin } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

/**
 * Network-wide publishing activity, for the platform credential.
 *
 * This page used to serve two identities at once — a credential admin *or* an
 * AIESEC position with `analytics.view_entity` — and branch internally on which
 * one turned up. The officer half now lives at `/insights`, where it belongs,
 * and this route is a single unambiguous guard again: `requireAdmin`, whole
 * network, no scope resolution.
 */
export default async function AdminActivityPage() {
  await requireAdmin();

  return (
    <PublishingActivity
      scope={{ kind: "all" }}
      breadcrumb={[{ label: "Admin" }, { label: "Activity" }]}
    />
  );
}
