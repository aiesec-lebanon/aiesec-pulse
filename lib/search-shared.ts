// Split from lib/search.ts (server-only, pulls in @/lib/db) so SearchForm
// ("use client") can import these without bundling the pg driver.

import type { PostKind } from "@/app/generated/prisma/enums";

export const KIND_LABELS: Record<PostKind, string> = {
  ANNOUNCEMENT: "Announcement",
  STORY: "Story",
  EVENT: "Event",
  OPPORTUNITY: "Opportunity",
  RESOURCE: "Resource",
  RECOGNITION: "Recognition",
};

export type FilterableEntity = { id: string; name: string; tag: string | null };
