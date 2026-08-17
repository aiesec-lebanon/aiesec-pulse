import Link from "next/link";

import { requirePermission } from "@/lib/rbac/guards";

export default async function PostQueuedPage() {
  await requirePermission("post.draft");

  return (
    <main className="flex-1 mx-auto w-full max-w-[1200px] px-6 py-24">
      <div className="mx-auto flex max-w-[480px] flex-col items-center gap-8 text-center">
        {/* Envelope illustration — muted tones, matches FeedIllustration visual family */}
        <div
          className="text-[var(--muted-foreground)] opacity-60 animate-float-drift"
          aria-hidden="true"
        >
          <EnvelopeIllustration className="h-auto w-32" />
        </div>

        {/* Message */}
        <div className="flex flex-col gap-4">
          <h1 className="text-[32px] font-black leading-[1.1] tracking-tight text-[var(--foreground)]">
            Your update is in review.
          </h1>
          <p className="text-[16px] leading-[1.6] text-[var(--muted-foreground)]">
            You&apos;ve used this week&apos;s allowance, so an editor in your entity will review
            this post before it appears in the global feed. We aim to review within 24 hours.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/feed" className="aiesec-btn-primary">
            Back to feed
          </Link>
          <Link href="/profile" className="aiesec-btn-secondary">
            View my posts
          </Link>
        </div>
      </div>
    </main>
  );
}

function EnvelopeIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Envelope body */}
      <rect
        x="8"
        y="14"
        width="84"
        height="46"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.04"
      />
      {/* Closed flap — V pointing down toward center */}
      <path
        d="M 8 14 L 50 42 L 92 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.06"
      />
      {/* Bottom-left fold crease */}
      <line
        x1="8"
        y1="60"
        x2="44"
        y2="38"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* Bottom-right fold crease */}
      <line
        x1="92"
        y1="60"
        x2="56"
        y2="38"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}
