import { PostStatus } from "@/app/generated/prisma/enums";
import { QueueCard } from "@/components/admin/QueueCard";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/feed";
import { requirePermission } from "@/lib/rbac/guards";
import { postScopeWhere, resolveScopeFilter } from "@/lib/rbac/scope-filter";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const user = await requirePermission("post.approve");
  const scope = await resolveScopeFilter(user, "post.approve");

  const posts = await db.post.findMany({
    where: { status: PostStatus.IN_REVIEW, ...postScopeWhere(scope) },
    orderBy: { createdAt: "asc" }, // oldest first — the queue is a queue
    take: 100,
    select: {
      id: true,
      title: true,
      bodyText: true,
      linkUrl: true,
      createdAt: true,
      cover: { select: { bucket: true, path: true, altText: true } },
      author: { select: { fullName: true } },
      publisher: { select: { name: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
      <h1 className="text-[24px] font-black text-[color:var(--foreground)]">Approval queue</h1>
      <p className="mt-1 text-[15px] text-[color:var(--muted-foreground)]">
        Posts submitted beyond their author&apos;s weekly allowance. Rejecting never destroys the
        post — the author sees your reason and can edit and resubmit.
      </p>

      {posts.length === 0 ? (
        <div className="aiesec-card mt-8 px-8 py-12 text-center">
          <p className="text-[16px] text-[color:var(--muted-foreground)]">
            Nothing is waiting for review.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {posts.map((post) => (
            <QueueCard
              key={post.id}
              postId={post.id}
              authorName={post.author.fullName}
              authorEntity={post.publisher.name}
              submittedAt={post.createdAt.toISOString()}
              title={post.title}
              content={post.bodyText}
              mediaUrl={mediaUrl(post.cover)}
              mediaAlt={post.cover?.altText ?? null}
              linkUrl={post.linkUrl}
            />
          ))}
        </div>
      )}
    </main>
  );
}
