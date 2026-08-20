import { type FollowingItem, FollowingPanel } from "@/components/settings/FollowingPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

export default async function FollowingSettingsPage() {
  const user = await requireSession();

  const follows = await db.follow.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const topicIds = follows.filter((f) => f.targetType === "TOPIC").map((f) => f.targetId);
  const entityIds = follows.filter((f) => f.targetType === "ENTITY").map((f) => f.targetId);

  // Not filtered to isActive: a follow of a since-deactivated topic/entity
  // should still be visible and removable here, not silently vanish.
  const [topics, entities] = await Promise.all([
    topicIds.length > 0
      ? db.topic.findMany({
          where: { id: { in: topicIds } },
          select: { id: true, slug: true, name: true },
        })
      : Promise.resolve([]),
    entityIds.length > 0
      ? db.entity.findMany({ where: { id: { in: entityIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const topicById = new Map(topics.map((t) => [t.id, t]));
  const entityById = new Map(entities.map((e) => [e.id, e]));

  const items: FollowingItem[] = follows
    .map((f): FollowingItem | null => {
      if (f.targetType === "TOPIC") {
        const topic = topicById.get(f.targetId);
        if (!topic) return null;
        return {
          targetType: "TOPIC",
          targetId: f.targetId,
          muted: f.muted,
          name: topic.name,
          href: `/topics/${topic.slug}`,
        };
      }
      if (f.targetType === "ENTITY") {
        const entity = entityById.get(f.targetId);
        if (!entity) return null;
        return {
          targetType: "ENTITY",
          targetId: f.targetId,
          muted: f.muted,
          name: entity.name,
          href: null,
        };
      }
      // USER follows have no UI yet (M9 only wires topics and entities).
      return null;
    })
    .filter((item): item is FollowingItem => item !== null);

  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pb-24">
      <PageHeader
        title="Following"
        standfirst="Topics and entities you follow or mute. This shapes what feels relevant in your feed."
        breadcrumb={[{ href: "/feed", label: "Feed" }, { label: "Following" }]}
      />

      <div className="mt-10">
        <FollowingPanel items={items} />
      </div>
    </main>
  );
}
