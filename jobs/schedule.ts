import { revalidatePath, revalidateTag } from "next/cache";

import type { Prisma } from "@/app/generated/prisma/client";
import { PostStatus } from "@/app/generated/prisma/enums";
import { recordAudit, systemActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// Served by `Post_due_idx`; caps a page so one very late catch-up run
// stays bounded.
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
 * where clause, so a retried or overlapping run can't double-publish.
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

/**
 * Triggered every few minutes by a Vercel/GitHub Actions cron hitting
 * /api/cron/publish-scheduled — see lib/cron-auth.ts. `asOf` lets the
 * test-only endpoint fast-forward past the wait instead of the two minutes
 * a real schedule would take.
 */
export async function runPublishScheduled(
  asOf: Date = new Date()
): Promise<{ due: number; published: number }> {
  const due = await db.post.findMany(dueScheduledPostsQuery(asOf));

  let published = 0;
  for (const post of due) {
    if (await publishDuePost(post)) published++;
  }

  if (published > 0) {
    revalidateTag("feed", "max");
    revalidatePath("/feed");
    revalidatePath("/profile");
  }

  logger.info("publish-scheduled complete", { due: due.length, published });
  return { due: due.length, published };
}
