// Split out of lib/search.ts: that module is "server-only" and pulls in
// @/lib/db (the pg driver, Node built-ins and all), so importing even one
// named export drags the whole graph into the browser bundle. This file has
// no server-only code, so SearchForm ("use client") can import it directly.

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
