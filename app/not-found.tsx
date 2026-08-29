import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-6">
      <EmptyState
        headingLevel="h1"
        heading="We couldn't find that."
        body="The page you're looking for doesn't exist or has been moved."
        action={{ href: "/feed", label: "Back to feed" }}
      />
    </main>
  );
}
