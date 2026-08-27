"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 flex-shrink-0 items-center border-b border-[var(--hairline)] px-6">
        <span className="pulse-label pulse-label-wide">AIESEC Pulse · Moderator</span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <RouteError
          error={error}
          reset={reset}
          eyebrow="Something went wrong"
          heading="An error occurred in the moderator portal"
          accentWord="moderator"
          body="Please try again. If it keeps happening, contact MC IM."
        />
      </main>
    </div>
  );
}
