"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[940px] flex-1 px-6">
      <RouteError error={error} reset={reset} />
    </main>
  );
}
