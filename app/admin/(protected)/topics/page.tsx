import { TopicForm } from "@/components/admin/TopicForm";
import { type TopicRow, TopicsTable } from "@/components/admin/TopicsTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

export default async function AdminTopicsPage() {
  await requireAdmin();

  const [topics, counts] = await Promise.all([
    db.topic.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, kind: true, isActive: true },
    }),
    // Unscoped by post status: a topic used only by drafts still reads as
    // "in use" for an admin deciding whether removing it is safe.
    db.postTopic.groupBy({ by: ["topicId"], _count: { topicId: true } }),
  ]);

  const countByTopic = new Map(counts.map((c) => [c.topicId, c._count.topicId]));
  const rows: TopicRow[] = topics.map((topic) => ({
    ...topic,
    postCount: countByTopic.get(topic.id) ?? 0,
  }));

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 pb-24 pt-8 sm:px-6">
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Topics" }]}
        title="Topics"
        standfirst="Functional areas, programmes, and editorial themes members tag posts with, follow, and browse by. Removing a topic hides it from every picker and filter — it does not delete the tag from posts that already carry it, and can be restored."
        bordered={false}
      />

      <section aria-labelledby="topics-heading" className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="topics-heading" className="text-[16px] font-bold text-[color:var(--foreground)]">
            All topics
          </h2>
          <p className="pulse-label">{rows.length} topics</p>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            heading="No topics yet."
            body="Add the first one below — it becomes taggable and browsable immediately."
          />
        ) : (
          <TopicsTable rows={rows} />
        )}
      </section>

      <section aria-labelledby="add-topic-heading" className="mt-10">
        <h2
          id="add-topic-heading"
          className="mb-3 text-[16px] font-bold text-[color:var(--foreground)]"
        >
          Add a topic
        </h2>
        <TopicForm />
      </section>
    </main>
  );
}
