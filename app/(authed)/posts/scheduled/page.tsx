import { CalendarClock } from "lucide-react";
import Link from "next/link";

import { requirePermission } from "@/lib/rbac/guards";

export default async function PostScheduledPage() {
  await requirePermission("post.draft");

  return (
    <main className="flex-1 mx-auto w-full max-w-[1200px] px-6 py-24">
      <div className="mx-auto flex max-w-[480px] flex-col items-center gap-8 text-center">
        <div
          className="text-[var(--muted-foreground)] opacity-60 animate-float-drift"
          aria-hidden="true"
        >
          <CalendarClock size={96} strokeWidth={1.25} />
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-[32px] font-black leading-[1.1] tracking-tight text-[var(--foreground)]">
            Your post is scheduled.
          </h1>
          <p className="text-[16px] leading-[1.6] text-[var(--muted-foreground)]">
            It will publish automatically at the time you chose. You can find it, and its scheduled
            time, under My posts.
          </p>
        </div>

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
