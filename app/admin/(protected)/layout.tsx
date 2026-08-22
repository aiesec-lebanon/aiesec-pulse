import { redirect } from "next/navigation";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus } from "@/app/generated/prisma/enums";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminSession } from "@/lib/auth/admin-session";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { permissionsOf, scopePathsFor } from "@/lib/rbac/can";

// Two identities reach this console and they see different halves of it.
// Configuring the platform is a credential login; moderating content is an
// AIESEC position. Neither confers the other, and holding both shows both.
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const [admin, user] = await Promise.all([getAdminSession(), getCurrentUser()]);

  if (!admin && !user) redirect("/admin/login");

  const permissions = user ? await permissionsOf(user) : new Set<string>();

  const sections = {
    queue: permissions.has("post.approve"),
    posts: permissions.has("moderation.hide"),
    comments: permissions.has("moderation.hide"),
    activity: Boolean(admin) || permissions.has("analytics.view_entity"),
    audit: Boolean(admin),
    roles: Boolean(admin),
    quotas: Boolean(admin),
    system: Boolean(admin),
    privacy: Boolean(admin),
    flags: Boolean(admin),
  };

  if (!Object.values(sections).some(Boolean)) redirect("/unauthorized");

  const approvalScopes = user ? await scopePathsFor(user, "post.approve") : [];
  const scopeWhere: Prisma.PostWhereInput = approvalScopes.includes(null)
    ? {}
    : {
        OR: approvalScopes
          .filter((path): path is string => path !== null)
          .flatMap<Prisma.PostWhereInput>((path) => [
            { publisher: { path } },
            { publisher: { path: { startsWith: `${path}/` } } },
          ]),
      };

  const queuedCount = sections.queue
    ? await db.post.count({ where: { status: PostStatus.IN_REVIEW, ...scopeWhere } })
    : 0;

  return (
    <AdminShell
      memberName={user?.fullName ?? null}
      adminEmail={admin?.email ?? null}
      queuedCount={queuedCount}
      sections={sections}
    >
      {children}
    </AdminShell>
  );
}
