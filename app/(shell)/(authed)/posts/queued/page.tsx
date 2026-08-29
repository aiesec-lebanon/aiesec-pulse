import { EmptyState } from "@/components/ui/EmptyState";
import { requirePermission } from "@/lib/rbac/guards";

export default async function PostQueuedPage() {
  await requirePermission("post.draft");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-6">
      <EmptyState
        headingLevel="h1"
        eyebrow="In review"
        heading="Your update is in review."
        body="You've used this week's allowance, so an editor in your entity will review this post before it appears in the global feed. We aim to review within 24 hours."
        action={{ href: "/feed", label: "Back to feed" }}
        secondaryAction={{ href: "/profile", label: "View my posts" }}
      />
    </main>
  );
}
