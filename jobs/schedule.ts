import { revalidatePath, revalidateTag } from "next/cache";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus } from "@/app/generated/prisma/enums";
import { inngest, JOB_IDS } from "@/jobs/client";
import { recordAudit, systemActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// Served by `Post_due_idx`: due posts, oldest first, one page per run. A single minute realistically never queues more than this,
// but the cap keeps one very late catch-up run bounded.
export const SCHEDULE_BATCH_LIMIT = 200;

export type DuePost = { id: string; title: string; publisherEntityId: string };

export function dueScheduledPostsQuery(now: Date = new Date()) {
  return {
    where: { status: PostStatus.SCHEDULED, scheduledAt: { lte: now } },
    orderBy: { scheduledAt: "asc" } as const,
    take: SCHEDULE_BATCH_LIMIT,
    select: { id: true, title: true, publisherEntityId: true } as const,
  } satisfies Prisma.PostFindManyArgs;
}

/**
 * Publishes one due post. Guarded by `status: SCHEDULED` in the update's
 * `where`, so a retried Inngest step or an overlapping run can never
 * double-publish or clobber a post the author has since pulled into another
 * state — a re-run of an already-published post is a no-op.
 */
export async function publishDuePost(post: DuePost): Promise<boolean> {
  const updated = await db.post.updateMany({
    where: { id: post.id, status: PostStatus.SCHEDULED },
    data: { status: PostStatus.PUBLISHED, publishedAt: new Date() },
  });
  if (updated.count === 0) return false;

  await recordAudit(
    systemActor("scheduler"),
    "post.published",
    { type: "post", id: post.id, entityId: post.publisherEntityId },
    { title: post.title, trigger: "schedule" }
  );
  return true;
}

export const publishScheduled = inngest.createFunction(
  { id: JOB_IDS.publishScheduled, retries: 2 },
  [{ cron: "* * * * *" }, { event: "posts/schedule.publish.requested" }],
  async ({ step }) => {
    const due = await step.run("select-due", () => db.post.findMany(dueScheduledPostsQuery()));

    let published = 0;
    for (const post of due) {
      const ok = await step.run(`publish-${post.id}`, () => publishDuePost(post));
      if (ok) published++;
    }

    if (published > 0) {
      await step.run("revalidate", () => {
        revalidateTag("feed", "max");
        revalidatePath("/feed");
        revalidatePath("/profile");
      });
    }

    logger.info("publish-scheduled complete", { due: due.length, published });
    return { due: due.length, published };
  }
);
