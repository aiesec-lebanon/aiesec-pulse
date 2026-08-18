import { notFound } from "next/navigation";

import { PostStatus } from "@/app/generated/prisma/enums";
import { VersionHistoryPanel } from "@/components/drafts/VersionHistoryPanel";
import { PostComposer } from "@/components/PostComposer";
import { sanitiseDocument } from "@/lib/content/document";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/feed";
import { isEnabled } from "@/lib/flags";
import { publishingRoleKeyFor } from "@/lib/org/scope";
import { quotaStateFor } from "@/lib/quota";
import { requirePermission } from "@/lib/rbac/guards";

// Named [slug], not [id]: Next.js requires every route sharing this position
// under /posts/ — this one and the published-post reader — to use the same
// dynamic segment name, even across different route groups. The lookup below
// still authorises on the post's real id; the slug is just the URL param.
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
      bodyJson: true,
      linkUrl: true,
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
  const [quota, richTextEnabled, schedulingEnabled] = await Promise.all([
    quotaStateFor(user.id, user.primaryEntityId, roleKey),
    isEnabled("posts.rich_text"),
    isEnabled("posts.scheduling"),
  ]);

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 py-10">
      <h1 className="text-[36px] font-black leading-[1.1] tracking-tight text-[var(--foreground)]">
        Edit your draft
      </h1>
      <p className="mt-2 text-[16px] text-[var(--muted-foreground)]">
        Your changes save automatically as you go.
      </p>

      <div className="mt-5 mb-8">
        {quota.atLimit ? (
          <span
            role="status"
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] px-3 py-1.5 text-[13px] font-medium text-[var(--destructive-text)]"
          >
            You&apos;ve used your {quota.max} {quota.max === 1 ? "post" : "posts"} for this week.
            Publishing this one will send it to the approval queue.
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

      <PostComposer
        richTextEnabled={richTextEnabled}
        schedulingEnabled={schedulingEnabled}
        timezone={user.timezone}
        postId={post.id}
        initialValues={{
          title: post.title,
          bodyJson: sanitiseDocument(post.bodyJson),
          linkUrl: post.linkUrl ?? "",
          mediaUrl: mediaUrl(post.cover),
          mediaAlt: post.cover?.altText ?? "",
        }}
      />

      <VersionHistoryPanel
        postId={post.id}
        versions={post.versions.map((v) => ({
          version: v.version,
          title: v.title,
          changeNote: v.changeNote,
          createdAt: v.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
