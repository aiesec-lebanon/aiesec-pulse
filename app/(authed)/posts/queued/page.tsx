import Link from "next/link";
import { requireMCP } from "@/lib/auth/guards";

export default async function QueuedPage() {
  await requireMCP();

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 py-20 text-center">
      {/* Icon */}
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--muted)]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--muted-foreground)]"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>

      <h1 className="text-[28px] font-black leading-[1.1] tracking-tight text-[var(--foreground)]">
        Post submitted for review
      </h1>

      <p className="mx-auto mt-4 max-w-[420px] text-[16px] leading-[1.6] text-[var(--muted-foreground)]">
        You&apos;ve used your 2 posts this week. Your update has been added to the
        approval queue and will appear in the feed once an admin approves it.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/feed"
          className="rounded-[var(--radius-sm)] bg-[var(--primary)] px-6 py-3 text-[16px] font-bold text-[var(--primary-foreground)] shadow-[0px_2px_0px_0px_rgba(5,145,255,0.1)] transition-opacity hover:opacity-90"
        >
          Back to feed
        </Link>
        <Link
          href="/posts/new"
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-6 py-3 text-[16px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          New post
        </Link>
      </div>
    </main>
  );
}
