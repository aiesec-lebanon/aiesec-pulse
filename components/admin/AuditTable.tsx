import Link from "next/link";

export type AuditRow = {
  id: string;
  actorLabel: string;
  actorType: "USER" | "SYSTEM" | "ADMIN";
  action: string;
  targetType: string;
  targetHref: string | null;
  targetLabel: string | null;
  entityName: string | null;
  timestampAbs: string;
  timestampIso: string;
};

const ACTOR_BADGE: Record<AuditRow["actorType"], { label: string; className: string }> = {
  USER: {
    label: "Member",
    className:
      "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] text-[color:var(--primary-text)]",
  },
  SYSTEM: {
    label: "System",
    className: "bg-[var(--muted)] text-[color:var(--muted-foreground)]",
  },
  ADMIN: {
    label: "Admin",
    className:
      "bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] text-[color:var(--destructive-text)]",
  },
};

function actionClass(action: string): string {
  if (action.includes("approve") || action.includes("restore")) {
    return "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[color:var(--success-text)]";
  }
  if (action.includes("reject") || action.includes("hidden") || action.includes("restrict")) {
    return "bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] text-[color:var(--destructive-text)]";
  }
  // `break_glass.*` actions can no longer be written — M17 deleted that path —
  // but rows from before it was removed are retained, and they are exactly the
  // rows a reader should not have to hunt for.
  if (action.includes("erase") || action.includes("break_glass")) {
    return "bg-[color-mix(in_srgb,var(--destructive)_18%,transparent)] text-[color:var(--destructive-text)]";
  }
  return "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[color:var(--primary-text)]";
}

function humanise(action: string): string {
  const words = action.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Audit log entries">
      {rows.map((row) => {
        const actor = ACTOR_BADGE[row.actorType];
        return (
          <article
            key={row.id}
            role="listitem"
            className="aiesec-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-[var(--radius-md)] px-2 py-0.5 text-[12px] font-medium ${actor.className}`}
              >
                {actor.label}
              </span>
              <span
                className={`rounded-[var(--radius-md)] px-2 py-0.5 text-[12px] font-medium ${actionClass(row.action)}`}
              >
                {humanise(row.action)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] text-[color:var(--foreground)]">
                <span className="font-medium">{row.actorLabel}</span>
                {row.targetLabel && (
                  <>
                    {" · "}
                    {row.targetHref ? (
                      <Link
                        href={row.targetHref}
                        className="text-[color:var(--primary-text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                      >
                        {row.targetLabel}
                      </Link>
                    ) : (
                      <span className="text-[color:var(--muted-foreground)]">
                        {row.targetLabel}
                      </span>
                    )}
                  </>
                )}
              </p>
              {row.entityName && (
                <p className="truncate text-[12px] text-[color:var(--muted-foreground)]">
                  {row.entityName}
                </p>
              )}
            </div>

            <time
              dateTime={row.timestampIso}
              className="shrink-0 text-[13px] tabular-nums text-[color:var(--muted-foreground)]"
            >
              {row.timestampAbs}
            </time>
          </article>
        );
      })}
    </div>
  );
}
