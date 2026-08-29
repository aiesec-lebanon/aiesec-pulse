import { EmptyState } from "@/components/ui/EmptyState";

export default function AuthorNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-6">
      <EmptyState
        headingLevel="h1"
        heading="We couldn't find that member."
        body="Their account may have been removed, or the link is out of date."
        action={{ href: "/feed", label: "Back to feed" }}
      />
    </main>
  );
}
