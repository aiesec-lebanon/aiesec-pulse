"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { restorePostVersion } from "@/app/actions/drafts";
import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { Pill } from "@/components/ui/Pill";

export type VersionHistoryEntry = {
  version: number;
  title: string;
  changeNote: string | null;
  createdAt: string;
};

export function VersionHistoryPanel({
  postId,
  versions,
}: {
  postId: string;
  versions: VersionHistoryEntry[];
}) {
  const router = useRouter();
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (versions.length === 0) return null;

  const currentVersion = versions[0].version;

  async function handleRestore(version: number) {
    setRestoringVersion(version);
    setError(null);

    const result = await restorePostVersion(postId, version);
    if (result.ok) {
      router.refresh();
      return; // restoringVersion stays set — the panel refreshes with the new "Current" row
    }
    setError(result.error);
    setRestoringVersion(null);
  }

  return (
    <section className="mt-10" aria-labelledby="version-history-heading">
      <DisplayTitle
        id="version-history-heading"
        as="h2"
        size="sm"
        title="Version history"
        className="text-[color:var(--foreground)]"
      />
      <div className="mt-3 flex flex-col" role="list" aria-label="Versions">
        {versions.map((entry) => {
          const isCurrent = entry.version === currentVersion;
          return (
            <article
              key={entry.version}
              role="listitem"
              className="flex flex-col gap-3 border-b border-[var(--hairline)] py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <time
                  dateTime={entry.createdAt}
                  className="block text-[14px] text-[color:var(--muted-foreground)]"
                >
                  {new Date(entry.createdAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                <p className="truncate text-[14px] text-[color:var(--foreground)]">
                  {entry.changeNote ?? entry.title}
                </p>
              </div>

              {isCurrent ? (
                <Pill
                  className="shrink-0"
                  label="Current"
                  tint="var(--muted)"
                  text="var(--muted-foreground)"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => void handleRestore(entry.version)}
                  disabled={restoringVersion !== null}
                  aria-label={`Restore version from ${new Date(entry.createdAt).toLocaleString("en-GB")}`}
                  className="min-h-[36px] shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:border-[var(--primary)] hover:text-[color:var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {restoringVersion === entry.version ? "Restoring…" : "Restore"}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--destructive-text)]">
          {error}
        </p>
      )}
    </section>
  );
}
