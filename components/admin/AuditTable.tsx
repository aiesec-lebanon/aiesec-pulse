import Link from "next/link";

export type AuditRow = {
  id: string;
  adminEmail: string;
  actionLabel: string;
  actionGroup: "approval" | "rejection" | "deletion";
  targetType: "post" | "comment";
  targetHref: string | null;
  targetLabel: string | null;
  timestampAbs: string;
  timestampIso: string;
};

const ACTION_PILL: Record<"approval" | "rejection" | "deletion", string> = {
  approval:
    "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
  rejection:
    "bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] text-[var(--destructive)]",
  deletion: "bg-[var(--muted)] text-[var(--muted-foreground)]",
};

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Audit log entries">
      {rows.map((row) => (
        <article
          key={row.id}
          role="listitem"
          className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] px-5 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5"
        >
          {/* Timestamp */}
          <time
            dateTime={row.timestampIso}
            className="text-[12px] font-medium text-[var(--muted-foreground)] tabular-nums flex-shrink-0"
          >
            {row.timestampAbs}
          </time>

          {/* Admin email */}
          <span className="text-[13px] font-bold text-[var(--foreground)] flex-shrink-0">
            {row.adminEmail}
          </span>

          {/* Action pill */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[12px] font-medium flex-shrink-0 ${ACTION_PILL[row.actionGroup]}`}
          >
            {row.actionLabel}
          </span>

          {/* Target */}
          <span className="text-[13px] text-[var(--muted-foreground)] min-w-0 truncate">
            {row.targetHref !== null ? (
              <Link
                href={row.targetHref}
                className="text-[var(--primary)] hover:underline underline-offset-2"
              >
                {row.targetLabel}
              </Link>
            ) : (
              <span className="italic">(deleted)</span>
            )}
          </span>
        </article>
      ))}
    </div>
  );
}
