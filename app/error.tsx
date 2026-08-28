"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col items-center justify-center px-6">
      <RouteError
        error={error}
        reset={reset}
        eyebrow="Something's not right"
        heading="Something went wrong on our end"
        accentWord="wrong"
        body="Try again in a moment. If it keeps happening, contact MC IM."
      />
    </main>
  );
}
