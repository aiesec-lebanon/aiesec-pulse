import { SecondaryPostCard } from "@/components/feed/SecondaryPostCard";
import { Reveal } from "@/components/motion/Reveal";
import type { FeedPost } from "@/types/feed";

// No new visual treatment — the same
// SecondaryPostCard the feed's secondary row already renders, arranged as a
// grid here instead of an invented rail.
export function RelatedPosts({ posts }: { posts: FeedPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section
      aria-labelledby="related-posts-heading"
      className="mt-16 border-t border-[var(--hairline)] pt-10"
    >
      <h2 id="related-posts-heading" className="pulse-label">
        Related posts
      </h2>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {posts.map((post, i) => (
          <Reveal key={post.id} y={24} delay={(i % 2) * 70} className="h-full">
            <SecondaryPostCard post={post} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
