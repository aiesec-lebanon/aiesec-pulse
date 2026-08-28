"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setFlagEnabled } from "@/app/actions/flags";
import { Pill } from "@/components/ui/Pill";

export type FlagRow = { key: string; enabled: boolean; updatedAt: string };

const STATE_TINT: Record<"on" | "off", { tint: string; text: string }> = {
  on: { tint: "color-mix(in srgb, var(--success) 10%, transparent)", text: "var(--success-text)" },
  off: { tint: "var(--muted)", text: "var(--muted-foreground)" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FlagsTable({ rows }: { rows: FlagRow[] }) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(row: FlagRow) {
    setBusyKey(row.key);
    setError(null);
    startTransition(async () => {
      const result = await setFlagEnabled(row.key, !row.enabled);
      if (!result.ok) setError(result.error);
      setBusyKey(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Feature flags">
      {error && (
        <p role="alert" className="text-[14px] text-[color:var(--destructive-text)]">
          {error}
        </p>
      )}

      {rows.map((row) => {
        const busy = pending && busyKey === row.key;
        return (
          <div
            key={row.key}
            role="listitem"
            className="aiesec-card flex flex-wrap items-center gap-3 p-4"
          >
            <Pill
              className="shrink-0"
              label={row.enabled ? "On" : "Off"}
              tint={STATE_TINT[row.enabled ? "on" : "off"].tint}
              text={STATE_TINT[row.enabled ? "on" : "off"].text}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-[color:var(--foreground)]">
                {row.key}
              </p>
              <p className="text-[13px] text-[color:var(--muted-foreground)]">
                Last changed {formatDate(row.updatedAt)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => toggle(row)}
              disabled={busy}
              aria-pressed={row.enabled}
              className="aiesec-btn-secondary min-h-[36px] shrink-0 disabled:opacity-50"
            >
              {busy ? "Saving…" : row.enabled ? "Turn off" : "Turn on"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
