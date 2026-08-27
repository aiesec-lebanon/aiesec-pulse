import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminSession } from "@/lib/auth/admin-session";

/**
 * `/admin` is the platform credential's console, and only that.
 *
 * It used to admit two identities and show them different halves of one shell:
 * a credential login for configuring the platform, and an AIESEC position for
 * moderating content. That was never a clean split, and three of the sections
 * it offered a position holder — the approval queue, all posts, comments —
 * were guarded by `requirePermission`, which needs a *member* session, so the
 * credential admin they were sitting beside could not open any of them.
 *
 * The position-held surfaces moved out to member-facing routes (`/review`,
 * `/moderation/posts`, `/moderation/comments`, `/insights`), where they sit in
 * the ordinary app shell alongside every other page a member uses. What is
 * left here is configuration, and it needs exactly one guard.
 */
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  return <AdminShell adminEmail={admin.email}>{children}</AdminShell>;
}
