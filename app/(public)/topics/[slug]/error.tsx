"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function TopicArchiveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6">
      <RouteError error={error} reset={reset} />
    </main>
  );
}
