import Link from "next/link";

import { Pill } from "@/components/ui/Pill";

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

const ACTOR_BADGE: Record<AuditRow["actorType"], { label: string; tint: string; text: string }> = {
  USER: {
    label: "Member",
    tint: "color-mix(in srgb, var(--primary) 8%, transparent)",
    text: "var(--primary-text)",
  },
  SYSTEM: {
    label: "System",
    tint: "var(--muted)",
    text: "var(--muted-foreground)",
  },
  ADMIN: {
    label: "Admin",
    tint: "color-mix(in srgb, var(--destructive) 10%, transparent)",
    text: "var(--destructive-text)",
  },
};

function actionTint(action: string): { tint: string; text: string } {
  if (action.includes("approve") || action.includes("restore")) {
    return {
      tint: "color-mix(in srgb, var(--success) 10%, transparent)",
      text: "var(--success-text)",
    };
  }
  if (action.includes("reject") || action.includes("hidden") || action.includes("restrict")) {
    return {
      tint: "color-mix(in srgb, var(--destructive) 10%, transparent)",
      text: "var(--destructive-text)",
    };
  }
  // `break_glass.*` can no longer be written, but old rows using it remain.
  if (action.includes("erase") || action.includes("break_glass")) {
    return {
      tint: "color-mix(in srgb, var(--destructive) 18%, transparent)",
      text: "var(--destructive-text)",
    };
  }
  return {
    tint: "color-mix(in srgb, var(--primary) 10%, transparent)",
    text: "var(--primary-text)",
  };
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
              <Pill label={actor.label} tint={actor.tint} text={actor.text} />
              <Pill
                label={humanise(row.action)}
                tint={actionTint(row.action).tint}
                text={actionTint(row.action).text}
              />
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
