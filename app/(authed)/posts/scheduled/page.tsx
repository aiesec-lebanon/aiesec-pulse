import { CalendarClock } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/motion/Reveal";
import { requirePermission } from "@/lib/rbac/guards";

export default async function PostScheduledPage() {
  await requirePermission("post.draft");

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 py-28">
      <div className="mx-auto flex max-w-[520px] flex-col items-center gap-8 text-center">
        <Reveal
          y={16}
          scale={0.94}
          className="animate-float-drift pulse-ambient text-[color:var(--muted-foreground)] opacity-60"
        >
          <CalendarClock size={96} strokeWidth={1.25} />
        </Reveal>

        <Reveal y={20} delay={90} className="flex flex-col gap-4">
          <h1 className="pulse-display pulse-display-md text-[color:var(--foreground)]">
            Your post is scheduled.
          </h1>
          <p className="text-[16px] leading-[1.6] text-[color:var(--muted-foreground)]">
            It will publish automatically at the time you chose. You can find it, and its scheduled
            time, under My posts.
          </p>
        </Reveal>

        <Reveal y={20} delay={180} className="flex flex-col gap-3 sm:flex-row">
          <Link href="/feed" className="aiesec-btn-primary">
            Back to feed
          </Link>
          <Link href="/profile" className="aiesec-btn-secondary">
            View my posts
          </Link>
        </Reveal>
      </div>
    </main>
  );
}
