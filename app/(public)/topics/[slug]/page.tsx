import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedIllustration } from "@/components/feed/FeedIllustration";
import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
import { db } from "@/lib/db";
import { getTopicFeed } from "@/lib/feed";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = await db.topic.findUnique({
    where: { slug },
    select: { name: true, isActive: true },
  });
  if (!topic || !topic.isActive) return { title: "Topic not found" };
  return { title: `${topic.name} · AIESEC Pulse` };
}

export default async function TopicArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  // Same visibility rule as the main feed: an inactive topic isn't a valid
  // browsing destination even if a stale link to it still exists.
  const topic = await db.topic.findUnique({
    where: { slug },
    select: { id: true, name: true, description: true, isActive: true },
  });
  if (!topic || !topic.isActive) return notFound();

  const { posts, hasNext } = await getTopicFeed(topic.id, page);

  return (
    <main className="w-full max-w-[1200px] flex-1 mx-auto px-6 py-10">
      <Link
        href="/feed"
        className="mb-6 inline-flex min-h-[24px] items-center gap-1.5 rounded-[var(--radius-sm)] text-[14px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Back to feed
      </Link>

      <h1 className="text-[32px] font-black leading-[1.1] tracking-tight text-[var(--foreground)]">
        {topic.name}
      </h1>
      {topic.description && (
        <p className="mt-2 max-w-[60ch] text-[16px] leading-[1.6] text-[var(--muted-foreground)]">
          {topic.description}
        </p>
      )}

      {posts.length === 0 ? (
        <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-6 text-center">
          <div
            className="text-[var(--muted-foreground)] opacity-60 animate-float-drift"
            aria-hidden="true"
          >
            <FeedIllustration className="h-auto w-36" />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-[20px] font-bold text-[var(--foreground)]">
              Nothing tagged {topic.name} yet.
            </h2>
            <p className="text-[16px] leading-[1.6] text-[var(--muted-foreground)]">
              When a post is tagged with this topic, it will appear here.
            </p>
          </div>
        </div>
      ) : (
        <section aria-label={`Posts about ${topic.name}`} className="mt-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <SecondaryPostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {(posts.length > 0 || page > 1) && (
        <nav aria-label="Topic pagination" className="mt-12 flex items-center justify-center gap-4">
          {page > 1 && (
            <a
              href={page === 2 ? `/topics/${slug}` : `/topics/${slug}?page=${page - 1}`}
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-[15px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              <span aria-hidden>←</span> Newer
            </a>
          )}
          {posts.length > 0 && (
            <span className="select-none text-[14px] tabular-nums text-[var(--muted-foreground)]">
              Page {page}
            </span>
          )}
          {hasNext && (
            <a
              href={`/topics/${slug}?page=${page + 1}`}
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-[15px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Older <span aria-hidden>→</span>
            </a>
          )}
        </nav>
      )}
    </main>
  );
}
