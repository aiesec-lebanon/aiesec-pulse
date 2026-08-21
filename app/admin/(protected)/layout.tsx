import { redirect } from "next/navigation";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus } from "@/app/generated/prisma/enums";
import { AdminShell } from "@/components/admin/AdminShell";
import { db } from "@/lib/db";
import { permissionsOf, scopePathsFor } from "@/lib/rbac/can";
import { requireSession } from "@/lib/rbac/guards";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const permissions = await permissionsOf(user);

  const sections = {
    queue: permissions.has("post.approve"),
    posts: permissions.has("moderation.hide"),
    comments: permissions.has("moderation.hide"),
    activity: permissions.has("analytics.view_network") || permissions.has("analytics.view_entity"),
    audit: permissions.has("admin.audit_view"),
    roles: permissions.has("admin.configure_roles"),
    privacy: permissions.has("admin.privacy_execute"),
    flags: permissions.has("admin.configure"),
  };

  if (!Object.values(sections).some(Boolean)) redirect("/unauthorized");

  const approvalScopes = await scopePathsFor(user, "post.approve");
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
    <AdminShell userName={user.fullName} queuedCount={queuedCount} sections={sections}>
      {children}
    </AdminShell>
  );
}
