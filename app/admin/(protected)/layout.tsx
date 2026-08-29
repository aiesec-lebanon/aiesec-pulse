import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminSession } from "@/lib/auth/admin-session";

/**
 * Platform-credential console only — guarded by requireAdmin/getAdminSession,
 * not requirePermission (there's no member session here). Position-scoped
 * surfaces live in the member app: /review, /moderation/*, /insights.
 */
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  return <AdminShell adminEmail={admin.email}>{children}</AdminShell>;
}
