import { BookmarksList } from "@/components/bookmarks/BookmarksList";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { TextTabs } from "@/components/ui/TextTabs";
import { getBookmarkedPosts, getBookmarksCount, getBookmarkTopics } from "@/lib/feed";
import { requireSession } from "@/lib/rbac/guards";

export const metadata = { title: "Bookmarks · AIESEC Pulse" };

function hrefFor(page: number, topicId: string | undefined): string {
  const qs = new URLSearchParams();
  if (topicId) qs.set("topic", topicId);
  if (page > 1) qs.set("page", String(page));
  const query = qs.toString();
  return query ? `/bookmarks?${query}` : "/bookmarks";
}

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; topic?: string }>;
}) {
  await requireSession();
  const { page: pageParam, topic: topicParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [{ posts, hasNext }, total, topics] = await Promise.all([
    getBookmarkedPosts(page, topicParam || undefined),
    getBookmarksCount(),
    getBookmarkTopics(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-24">
      <PageHeader
        breadcrumb={[{ href: "/feed", label: "Feed" }, { label: "Saved" }]}
        title="Bookmarks"
        standfirst="Stories you have bookmarked across every topic, in one place — most recently saved first."
        count={total}
        countLabel="saved"
      />

      {total === 0 ? (
        <EmptyState
          eyebrow="Nothing saved"
          heading="No bookmarks yet."
          accentWord="bookmarks"
          body="Save a story from its bookmark icon — on the feed, a topic archive, or the story itself — and it will show up here."
          action={{ href: "/feed", label: "Browse the feed" }}
        />
      ) : (
        <>
          {topics.length > 0 && (
            <TextTabs
              ariaLabel="Filter by topic"
              className="mt-10"
              items={[
                { href: hrefFor(1, undefined), label: "All", isActive: !topicParam },
                ...topics.map((topic) => ({
                  href: hrefFor(1, topic.id),
                  label: topic.name,
                  isActive: topicParam === topic.id,
                })),
              ]}
            />
          )}

          {posts.length === 0 ? (
            <EmptyState
              heading="Nothing saved with this topic."
              body="Clear the filter to see everything you've bookmarked."
              action={{ href: "/bookmarks", label: "Show all bookmarks" }}
            />
          ) : (
            <BookmarksList initialPosts={posts} />
          )}
        </>
      )}

      <Pagination
        label="Bookmarks pagination"
        page={page}
        hasNext={hasNext}
        previousHref={page > 1 ? hrefFor(page - 1, topicParam) : null}
        nextHref={hrefFor(page + 1, topicParam)}
      />
    </main>
  );
}
