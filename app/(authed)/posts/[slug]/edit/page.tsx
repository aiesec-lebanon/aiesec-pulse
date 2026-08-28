import { notFound } from "next/navigation";

import { PostStatus } from "@/app/generated/prisma/enums";
import { VersionHistoryPanel } from "@/components/drafts/VersionHistoryPanel";
import { PostComposer } from "@/components/PostComposer";
import { PageHeader } from "@/components/ui/PageHeader";
import { sanitiseDocument } from "@/lib/content/document";
import { reachOptionsFor } from "@/lib/content/level";
import { listActiveTopics } from "@/lib/content/topics";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/feed";
import { isEnabled } from "@/lib/flags";
import { entityDisplayName } from "@/lib/org/display";
import { availableAudiencesFor, publishingRoleKeyFor } from "@/lib/org/scope";
import { quotaStateFor } from "@/lib/quota";
import { requirePermission } from "@/lib/rbac/guards";

// Named [slug], not [id]: Next.js requires every route sharing this position
// under /posts/ — this one and the published-post reader — to share a
// dynamic segment name, even across different route groups. The lookup
// below still authorises on the post's real id; slug is just the URL param.
export default async function EditDraftPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requirePermission("post.draft");

  const post = await db.post.findUnique({
    where: { slug },
    select: {
      id: true,
      authorId: true,
      status: true,
      title: true,
      titleAccent: true,
      bodyJson: true,
      summary: true,
      linkUrl: true,
      publisherEntityId: true,
      cover: { select: { bucket: true, path: true, altText: true } },
      versions: {
        select: { version: true, title: true, changeNote: true, createdAt: true },
        orderBy: { version: "desc" },
      },
    },
  });
  if (!post || post.authorId !== user.id || post.status !== PostStatus.DRAFT) {
    return notFound();
  }

  const roleKey = await publishingRoleKeyFor(user.id);
  const [quota, richTextEnabled, schedulingEnabled, targetingEnabled, topics, authorEntity] =
    await Promise.all([
      quotaStateFor(user.id, user.primaryEntityId, roleKey),
      isEnabled("posts.rich_text"),
      isEnabled("posts.scheduling"),
      isEnabled("posts.targeting"),
      listActiveTopics(),
      db.entity.findUnique({
        where: { id: post.publisherEntityId },
        select: { name: true, kind: true },
      }),
    ]);
  const audienceOptions = targetingEnabled
    ? await availableAudiencesFor(user, post.publisherEntityId)
    : undefined;
  const reachOptions = await reachOptionsFor(user, post.publisherEntityId, roleKey);

  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pb-24 lg:max-w-[1360px]">
      <PageHeader
        title="Edit your draft"
        standfirst="Your changes save automatically as you go."
        breadcrumb={[
          { href: "/feed", label: "Feed" },
          { href: "/drafts", label: "Drafts" },
          { label: "Edit" },
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
            Publishing this one will send it to the approval queue.
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
        postId={post.id}
        authorDisplayName={user.fullName}
        authorEntityName={entityDisplayName(authorEntity?.name, authorEntity?.kind)}
        initialValues={{
          title: post.title,
          titleAccent: post.titleAccent ?? "",
          bodyJson: sanitiseDocument(post.bodyJson),
          summary: post.summary ?? "",
          linkUrl: post.linkUrl ?? "",
          mediaUrl: mediaUrl(post.cover),
          mediaAlt: post.cover?.altText ?? "",
        }}
      />

      <div className="lg:max-w-[820px]">
        <VersionHistoryPanel
          postId={post.id}
          versions={post.versions.map((v) => ({
            version: v.version,
            title: v.title,
            changeNote: v.changeNote,
            createdAt: v.createdAt.toISOString(),
          }))}
        />
      </div>
    </main>
  );
}
