"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { TopicKind } from "@/app/generated/prisma/enums";
import { adminActor, withAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { checkAdmin } from "@/lib/rbac/guards";
import { slugBase } from "@/lib/slug";

export type TopicActionResult = { ok: true } | { ok: false; error: string };

const MAX_NAME_LENGTH = 60;
const MAX_SLUG_LENGTH = 40;
const MAX_DESCRIPTION_LENGTH = 200;

const createTopicSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(MAX_NAME_LENGTH),
  kind: z.nativeEnum(TopicKind),
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
});

export type CreateTopicInput = z.input<typeof createTopicSchema>;

/**
 * Topics are a small curated catalogue (architecture.md §7.4/§7.5), not a
 * high-volume user-generated one — a name collision is rejected outright
 * rather than disambiguated with a random suffix the way post slugs are.
 */
export async function createTopic(input: CreateTopicInput): Promise<TopicActionResult> {
  const authorised = await checkAdmin();
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const parsed = createTopicSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid topic." };
  }

  const slug = slugBase(parsed.data.name, MAX_SLUG_LENGTH);
  if (!slug) return { ok: false, error: "That name doesn't produce a usable URL slug." };

  const clash = await db.topic.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  });
  if (clash) {
    return {
      ok: false,
      error: clash.isActive
        ? "A topic with that name already exists."
        : "A removed topic already has that name — restore it instead of creating a duplicate.",
    };
  }

  const topic = await db.topic.create({
    data: {
      slug,
      name: parsed.data.name,
      kind: parsed.data.kind,
      description: parsed.data.description || null,
    },
    select: { id: true },
  });

  return withAudit(
    adminActor(authorised.admin),
    "topic.created",
    { type: "topic", id: topic.id },
    { slug, name: parsed.data.name, kind: parsed.data.kind },
    async () => {
      revalidatePath("/admin/topics");
      return { ok: true as const };
    }
  );
}

/**
 * "Remove" hides rather than deletes — architecture.md principle 8. A hard
 * delete would cascade through `PostTopic` and silently untag every post
 * that ever carried it, with no audit trail and no way back. Deactivating
 * reuses the same `isActive` gate `listActiveTopics`/the topic archive page
 * already enforce, so a removed topic disappears from every picker, filter,
 * and browse surface but its history on existing posts is untouched.
 */
export async function setTopicActive(
  topicId: string,
  isActive: boolean
): Promise<TopicActionResult> {
  const authorised = await checkAdmin();
  if (!authorised.ok) return { ok: false, error: authorised.error };

  const topic = await db.topic.findUnique({
    where: { id: topicId },
    select: { id: true, slug: true, name: true, isActive: true },
  });
  if (!topic) return { ok: false, error: "That topic no longer exists." };
  if (topic.isActive === isActive) return { ok: true };

  return withAudit(
    adminActor(authorised.admin),
    isActive ? "topic.restored" : "topic.archived",
    { type: "topic", id: topic.id },
    { slug: topic.slug, name: topic.name },
    async () => {
      await db.topic.update({ where: { id: topic.id }, data: { isActive } });
      revalidatePath("/admin/topics");
      return { ok: true as const };
    }
  );
}
