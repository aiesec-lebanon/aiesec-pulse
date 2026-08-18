import { PostComposer } from "@/components/PostComposer";
import { db } from "@/lib/db";
import { isEnabled } from "@/lib/flags";
import { quotaStateFor } from "@/lib/quota";
import { requirePermission } from "@/lib/rbac/guards";

async function publishingRoleKey(userId: string): Promise<string> {
  const grants = await db.roleGrant.findMany({
    where: {
      userId,
      revokedAt: null,
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    select: { role: { select: { key: true } } },
  });
  for (const key of ["platform_admin", "global_publisher", "entity_editor", "entity_publisher"]) {
    if (grants.some((g) => g.role.key === key)) return key;
  }
  return "entity_publisher";
}

export default async function NewPostPage() {
  const user = await requirePermission("post.draft");
  const roleKey = await publishingRoleKey(user.id);
  const [quota, richTextEnabled] = await Promise.all([
    quotaStateFor(user.id, user.primaryEntityId, roleKey),
    isEnabled("posts.rich_text"),
  ]);

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 py-10">
      <h1 className="text-[36px] font-black leading-[1.1] tracking-tight text-[var(--foreground)]">
        Share an update
      </h1>
      <p className="mt-2 text-[16px] text-[var(--muted-foreground)]">
        Your post will reach AIESEC members worldwide.
      </p>

      <div className="mt-5 mb-8">
        {quota.atLimit ? (
          <span
            role="status"
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] px-3 py-1.5 text-[13px] font-medium text-[var(--destructive-text)]"
          >
            You&apos;ve used your {quota.max} {quota.max === 1 ? "post" : "posts"} for this week.
            The next one goes to the approval queue.
          </span>
        ) : (
          <span
            role="status"
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--muted)] px-3 py-1.5 text-[13px] font-medium text-[var(--muted-foreground)]"
          >
            Posts this week: {quota.used} of {quota.max}
          </span>
        )}
      </div>

      <PostComposer richTextEnabled={richTextEnabled} />
    </main>
  );
}
