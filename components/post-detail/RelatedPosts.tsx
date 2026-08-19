import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
import type { FeedPost } from "@/types/feed";

// Design Guidelines §10.11: no new visual treatment — the same
// SecondaryPostCard the feed's secondary row already renders, arranged as a
// grid here instead of an invented rail.
export function RelatedPosts({ posts }: { posts: FeedPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section
      aria-labelledby="related-posts-heading"
      className="mt-12 border-t border-[var(--border)] pt-8"
    >
      <h2 id="related-posts-heading" className="text-[20px] font-bold text-[var(--foreground)]">
        Related posts
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <SecondaryPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
