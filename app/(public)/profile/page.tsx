// Todo: Implement profile page with user details, posts, and activity feed

import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";

export default async function ProfilePage() {
  await requireUser();

  return (
    <main className="flex-1 mx-auto w-full max-w-[1200px] px-6 py-24">
      <div className="mx-auto max-w-[480px]">
        <div className="aiesec-card px-8 py-12 text-center">
          <h1 className="text-[24px] font-bold text-[var(--foreground)]">
            Coming soon
          </h1>
          <p className="mt-3 text-[16px] leading-[1.6] text-[var(--muted-foreground)]">
            Your posts and activity will appear here.
          </p>
          <Link href="/feed" className="aiesec-btn-secondary mt-6">
            Back to feed
          </Link>
        </div>
      </div>
    </main>
  );
}
