"use server";

import { EntityKind } from "@/app/generated/prisma/enums";
import { type EntitySearchResult, searchEntitiesByName } from "@/lib/org/entities";
import { requireSession } from "@/lib/rbac/guards";

/** Backs the composer's audience typeahead (components/composer/AudiencePicker.tsx). */
export async function searchEntities(query: string): Promise<EntitySearchResult[]> {
  await requireSession();
  return searchEntitiesByName(query, [EntityKind.MC, EntityKind.LC]);
}
