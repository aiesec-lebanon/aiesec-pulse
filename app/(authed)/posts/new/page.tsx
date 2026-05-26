import { requireMCP } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { currentIsoWeek } from "@/lib/week";
import { PostStatus } from "@/app/generated/prisma/enums";
import { PostComposer } from "@/components/PostComposer";

async function getWeekPostCount(userId: string): Promise<number> {
  return db.post.count({
    where: {
      authorId: userId,
      weekIso: currentIsoWeek(),
      status: { in: [PostStatus.PUBLISHED, PostStatus.PENDING] },
    },
  });
}

export default async function NewPostPage() {
  const user = await requireMCP();
  const weekCount = await getWeekPostCount(user.id);
  const atLimit = weekCount >= 2;

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 py-10">

      {/* ── Header ── */}
      <h1 className="text-[36px] font-black leading-[1.1] tracking-tight text-[var(--foreground)]">
        Share an update
      </h1>
      <p className="mt-2 text-[16px] text-[var(--muted-foreground)]">
        Your post will reach AIESEC members worldwide.
      </p>

      {/* ── Week-usage banner ── */}
      <div className="mt-5 mb-8">
        {atLimit ? (
          <span
            role="status"
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--destructive)]/10 px-3 py-1.5 text-[13px] font-medium text-[var(--destructive)]"
          >
            You&apos;ve used your 2 posts this week. The next post will go to the
            approval queue.
          </span>
        ) : (
          <span
            role="status"
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--muted)] px-3 py-1.5 text-[13px] font-medium text-[var(--muted-foreground)]"
          >
            Posts this week: {weekCount} of 2
          </span>
        )}
      </div>

      {/* ── Composer ── */}
      <PostComposer />
    </main>
  );
}
