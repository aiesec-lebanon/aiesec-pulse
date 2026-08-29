import { PublishingActivity } from "@/components/insights/PublishingActivity";
import { requireAdmin } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

/**
 * Network-wide publishing activity, for the platform credential.
 * Officer-scoped analytics (`analytics.view_entity`) live at `/insights`.
 */
export default async function AdminActivityPage() {
  await requireAdmin();

  return (
    <PublishingActivity
      scope={{ kind: "all" }}
      breadcrumb={[{ label: "Admin" }, { label: "Activity" }]}
      variant="dense"
    />
  );
}
