import Link from "next/link";
import { FeedIllustration } from "@/components/feed/FeedIllustration";

interface FeedEmptyStateProps {
  isMCP?: boolean;
}

export function FeedEmptyState({ isMCP = false }: FeedEmptyStateProps) {
  return (
    <main className="flex-1 mx-auto w-full max-w-[1200px] px-6 py-24">
      <div className="flex flex-col items-center text-center gap-6">
        <div
          className="text-[var(--muted-foreground)] opacity-60 animate-float-drift"
          aria-hidden="true"
        >
          <FeedIllustration className="w-36 h-auto" />
        </div>

        <div className="flex flex-col gap-3 max-w-sm">
          <h2 className="text-[20px] font-bold text-[var(--foreground)]">
            The feed is quiet — for now.
          </h2>
          <p className="text-[16px] leading-[1.6] text-[var(--muted-foreground)]">
            When MCPs share updates, they&apos;ll appear here. Check back soon.
          </p>
        </div>

        {isMCP && (
          <Link href="/posts/new" className="aiesec-btn-primary">
            Be the first to post
          </Link>
        )}
      </div>
    </main>
  );
}
