import { EmptyState } from "@/components/ui/EmptyState";
import { requirePermission } from "@/lib/rbac/guards";

export default async function PostScheduledPage() {
  await requirePermission("post.draft");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-6">
      <EmptyState
        headingLevel="h1"
        eyebrow="Scheduled"
        heading="Your post is scheduled."
        body="It will publish automatically at the time you chose. You can find it, and its scheduled time, under My posts."
        action={{ href: "/feed", label: "Back to feed" }}
        secondaryAction={{ href: "/profile", label: "View my posts" }}
      />
    </main>
  );
}
