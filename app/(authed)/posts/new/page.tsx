import { PostComposer } from "@/components/PostComposer";
import { PageHeader } from "@/components/ui/PageHeader";
import { listActiveTopics } from "@/lib/content/topics";
import { isEnabled } from "@/lib/flags";
import { availableAudiencesFor, publishingRoleKeyFor } from "@/lib/org/scope";
import { quotaStateFor } from "@/lib/quota";
import { requirePermission } from "@/lib/rbac/guards";

export default async function NewPostPage() {
  const user = await requirePermission("post.draft");
  const roleKey = await publishingRoleKeyFor(user.id);
  const [quota, richTextEnabled, schedulingEnabled, targetingEnabled, topics] = await Promise.all([
    quotaStateFor(user.id, user.primaryEntityId, roleKey),
    isEnabled("posts.rich_text"),
    isEnabled("posts.scheduling"),
    isEnabled("posts.targeting"),
    listActiveTopics(),
  ]);
  const audienceOptions =
    targetingEnabled && user.primaryEntityId
      ? await availableAudiencesFor(user, user.primaryEntityId)
      : undefined;

  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pb-24">
      <PageHeader
        title="Share an update"
        standfirst="Your post will reach AIESEC members worldwide."
        breadcrumb={[
          { href: "/feed", label: "Feed" },
          { href: "/drafts", label: "Drafts" },
          { label: "New post" },
        ]}
        bordered={false}
      />

      <div className="mb-10 mt-2">
        {quota.atLimit ? (
          <span
            role="status"
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] px-3 py-1.5 text-[13px] font-medium text-[color:var(--destructive-text)]"
          >
            You&apos;ve used your {quota.max} {quota.max === 1 ? "post" : "posts"} for this week.
            The next one goes to the approval queue.
          </span>
        ) : (
          <span
            role="status"
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--muted)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--muted-foreground)]"
          >
            Posts this week: {quota.used} of {quota.max}
          </span>
        )}
      </div>

      <PostComposer
        richTextEnabled={richTextEnabled}
        schedulingEnabled={schedulingEnabled}
        timezone={user.timezone}
        audienceOptions={audienceOptions}
        topics={topics}
      />
    </main>
  );
}
