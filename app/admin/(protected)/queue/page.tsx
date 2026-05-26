import { db } from "@/lib/db";
import { PostStatus } from "@/app/generated/prisma/enums";
import { relativeTime } from "@/lib/relative-time";
import { QueueCard } from "@/components/admin/QueueCard";

export const dynamic = "force-dynamic";

export default async function AdminQueuePage() {
  const posts = await db.post.findMany({
    where: { status: PostStatus.PENDING },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { fullName: true, committeeName: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-[860px] px-6 py-8">
      <h1 className="text-[20px] font-bold text-[var(--foreground)] mb-8">
        Approval Queue
        {posts.length > 0 && (
          <span className="ml-3 inline-flex items-center justify-center min-w-[24px] h-6 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-[12px] font-bold px-1.5 tabular-nums align-middle">
            {posts.length > 99 ? "99+" : posts.length}
          </span>
        )}
      </h1>

      {posts.length === 0 ? (
        <QueueEmptyState />
      ) : (
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <QueueCard
              key={post.id}
              postId={post.id}
              authorName={post.author.fullName}
              authorEntity={post.author.committeeName ?? ""}
              submittedAt={relativeTime(post.createdAt)}
              title={post.title}
              content={post.content}
              mediaUrl={post.mediaUrl ?? null}
              linkUrl={post.linkUrl ?? null}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function QueueEmptyState() {
  return (
    <div className="flex flex-col items-center py-24 gap-6 text-center">
      <div className="text-[var(--muted-foreground)] opacity-50" aria-hidden="true">
        <svg
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-20 h-20"
        >
          {/* Outer circle */}
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="6 4"
            opacity="0.4"
          />
          {/* Check mark */}
          <path
            d="M24 40 L35 52 L56 28"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex flex-col gap-2 max-w-xs">
        <p className="text-[20px] font-bold text-[var(--foreground)]">
          Queue is empty — nice work.
        </p>
        <p className="text-[16px] leading-[1.6] text-[var(--muted-foreground)]">
          All submissions have been reviewed.
        </p>
      </div>
    </div>
  );
}
