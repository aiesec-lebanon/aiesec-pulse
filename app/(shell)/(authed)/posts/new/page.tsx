import { PostComposer } from "@/components/PostComposer";
import { PageHeader } from "@/components/ui/PageHeader";
import { reachOptionsFor } from "@/lib/content/level";
import { listActiveTopics } from "@/lib/content/topics";
import { db } from "@/lib/db";
import { isEnabled } from "@/lib/flags";
import { entityDisplayName } from "@/lib/org/display";
import { availableAudiencesFor, publishingRoleKeyFor } from "@/lib/org/scope";
import { quotaStateFor } from "@/lib/quota";
import { requirePermission } from "@/lib/rbac/guards";

export default async function NewPostPage() {
  const user = await requirePermission("post.draft");
  const roleKey = await publishingRoleKeyFor(user.id);
  const [quota, richTextEnabled, schedulingEnabled, targetingEnabled, topics, authorEntity] =
    await Promise.all([
      quotaStateFor(user.id, user.primaryEntityId, roleKey),
      isEnabled("posts.rich_text"),
      isEnabled("posts.scheduling"),
      isEnabled("posts.targeting"),
      listActiveTopics(),
      user.primaryEntityId
        ? db.entity.findUnique({
            where: { id: user.primaryEntityId },
            select: { name: true, kind: true },
          })
        : Promise.resolve(null),
    ]);
  const audienceOptions =
    targetingEnabled && user.primaryEntityId
      ? await availableAudiencesFor(user, user.primaryEntityId)
      : undefined;
  // Unflagged, like the promotion panel on post detail: reach is the level
  // model itself, not one of the authoring features behind a switch.
  const reachOptions = user.primaryEntityId
    ? await reachOptionsFor(user, user.primaryEntityId, roleKey)
    : undefined;

  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pb-24 lg:max-w-[1360px]">
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
        reachOptions={reachOptions}
        authorDisplayName={user.fullName}
        authorEntityName={entityDisplayName(authorEntity?.name, authorEntity?.kind)}
      />
    </main>
  );
}
