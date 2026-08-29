"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setTopicActive } from "@/app/actions/topics";
import type { TopicKind } from "@/app/generated/prisma/enums";
import { MetaLine } from "@/components/ui/MetaLine";
import { Pill } from "@/components/ui/Pill";
import { TOPIC_KIND_LABELS } from "@/lib/topics-shared";

export type TopicRow = {
  id: string;
  slug: string;
  name: string;
  kind: TopicKind;
  isActive: boolean;
  postCount: number;
};

const STATE_TINT: Record<"active" | "removed", { tint: string; text: string }> = {
  active: {
    tint: "color-mix(in srgb, var(--success) 10%, transparent)",
    text: "var(--success-text)",
  },
  removed: { tint: "var(--muted)", text: "var(--muted-foreground)" },
};

export function TopicsTable({ rows }: { rows: TopicRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(row: TopicRow) {
    setBusyId(row.id);
    setError(null);
    startTransition(async () => {
      const result = await setTopicActive(row.id, !row.isActive);
      if (!result.ok) setError(result.error);
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Topics">
      {error && (
        <p role="alert" className="text-[14px] text-[color:var(--destructive-text)]">
          {error}
        </p>
      )}

      {rows.map((row) => {
        const busy = pending && busyId === row.id;
        const state = row.isActive ? "active" : "removed";
        return (
          <div
            key={row.id}
            role="listitem"
            className="aiesec-card flex flex-wrap items-center gap-3 p-4"
          >
            <Pill
              className="shrink-0"
              label={row.isActive ? "Active" : "Removed"}
              tint={STATE_TINT[state].tint}
              text={STATE_TINT[state].text}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-[color:var(--foreground)]">
                {row.name}
              </p>
              <MetaLine
                items={[
                  `/topics/${row.slug}`,
                  TOPIC_KIND_LABELS[row.kind],
                  row.postCount === 1 ? "1 post" : `${row.postCount} posts`,
                ]}
              />
            </div>

            <button
              type="button"
              onClick={() => toggle(row)}
              disabled={busy}
              aria-pressed={row.isActive}
              className="aiesec-btn-secondary min-h-[36px] shrink-0 disabled:opacity-50"
            >
              {busy ? "Saving…" : row.isActive ? "Remove" : "Restore"}
              <span className="sr-only"> the {row.name} topic</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
