import "server-only";

import type { TopicKind } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";

export type TopicOption = { id: string; slug: string; name: string; kind: TopicKind };

export async function listActiveTopics(): Promise<TopicOption[]> {
  return db.topic.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, kind: true },
  });
}

/**
 * Silently drops ids that aren't a real, active topic rather than reject
 * the submission — tags carry no authorisation weight, unlike targeting.
 */
export async function resolveValidTopicIds(topicIds: string[]): Promise<string[]> {
  if (topicIds.length === 0) return [];

  const rows = await db.topic.findMany({
    where: { id: { in: topicIds }, isActive: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
