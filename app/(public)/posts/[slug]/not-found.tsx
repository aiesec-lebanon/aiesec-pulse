import { EmptyState } from "@/components/ui/EmptyState";

export default function PostNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-6">
      <EmptyState
        headingLevel="h1"
        heading="We couldn't find that."
        body="This post may have been removed, or it isn't visible to your entity."
        action={{ href: "/feed", label: "Back to feed" }}
      />
    </main>
  );
}
