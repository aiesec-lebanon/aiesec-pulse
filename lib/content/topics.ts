import "server-only";

import { db } from "@/lib/db";

export type TopicOption = { id: string; slug: string; name: string };

export async function listActiveTopics(): Promise<TopicOption[]> {
  return db.topic.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

/**
 * Silently drops any id that doesn't name a real, active topic, rather than
 * rejecting the submission — a tag carries no authorisation weight (unlike
 * audience targeting), so a stale or tampered id is simply not applied.
 */
export async function resolveValidTopicIds(topicIds: string[]): Promise<string[]> {
  if (topicIds.length === 0) return [];

  const rows = await db.topic.findMany({
    where: { id: { in: topicIds }, isActive: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
