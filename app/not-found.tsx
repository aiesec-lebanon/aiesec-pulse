import Link from "next/link";
import { FeedIllustration } from "@/components/feed/FeedIllustration";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
      <div className="flex flex-col items-center text-center gap-6 max-w-sm">
        <div className="text-[var(--muted-foreground)] opacity-60" aria-hidden="true">
          <FeedIllustration className="w-36 h-auto" />
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="text-[20px] font-bold text-[var(--foreground)]">
            We couldn&apos;t find that.
          </h1>
          <p className="text-[16px] leading-[1.6] text-[var(--muted-foreground)]">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <Link href="/feed" className="aiesec-btn-primary">
          Back to feed
        </Link>
      </div>
    </main>
  );
}
