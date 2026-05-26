import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PostStatus } from "@/app/generated/prisma/enums";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth: proxy already guards /admin/*, but we verify here too.
  const session = await requireAdmin();

  const [admin, pendingCount] = await Promise.all([
    db.admin.findUnique({ where: { id: session.sub }, select: { email: true } }),
    db.post.count({ where: { status: PostStatus.PENDING } }),
  ]);

  return (
    <AdminShell adminEmail={admin?.email ?? "Admin"} pendingCount={pendingCount}>
      {children}
    </AdminShell>
  );
}
