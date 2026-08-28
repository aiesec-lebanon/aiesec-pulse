import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminSession } from "@/lib/auth/admin-session";

/**
 * `/admin` is the platform credential's console only — guarded by
 * `requireAdmin`/`getAdminSession`, not `requirePermission` (which needs a
 * member session this layout never has). Position-scoped surfaces belong in
 * the member-facing app instead: `/review`, `/moderation/posts`,
 * `/moderation/comments`, `/insights`.
 */
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  return <AdminShell adminEmail={admin.email}>{children}</AdminShell>;
}
