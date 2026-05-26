import Link from "next/link";
import { relativeTime } from "@/lib/relative-time";

export type ActivityRow = {
  userId: string;
  name: string;
  entity: string;
  totalPosts: number;
  postsThisWeek: number;
  postsThisMonth: number;
  pending: number;
  lastPost: Date | null;
};

export type SortKey =
  | "name"
  | "entity"
  | "totalPosts"
  | "postsThisWeek"
  | "postsThisMonth"
  | "pending"
  | "lastPost";

export type SortDir = "asc" | "desc";

interface ActivityTableProps {
  rows: ActivityRow[];
  sort: SortKey;
  dir: SortDir;
}

const COLS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Name" },
  { key: "entity", label: "Entity" },
  { key: "totalPosts", label: "Total", numeric: true },
  { key: "postsThisWeek", label: "This week", numeric: true },
  { key: "postsThisMonth", label: "This month", numeric: true },
  { key: "pending", label: "Pending", numeric: true },
  { key: "lastPost", label: "Last post" },
];

export function ActivityTable({ rows, sort, dir }: ActivityTableProps) {
  function colHref(key: SortKey): string {
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc";
    return `/admin/activity?sort=${key}&dir=${nextDir}`;
  }

  function sortIndicator(key: SortKey) {
    if (sort !== key) return null;
    return (
      <span aria-hidden="true" className="ml-0.5 opacity-70">
        {dir === "desc" ? "↓" : "↑"}
      </span>
    );
  }

  return (
    <div>
      {/* Column headers */}
      <div
        className="hidden md:grid gap-3 px-5 py-2 mb-1"
        style={{ gridTemplateColumns: "1fr 120px 72px 80px 88px 72px 96px" }}
        role="row"
        aria-label="Column headers"
      >
        {COLS.map(({ key, label, numeric }) => (
          <Link
            key={key}
            href={colHref(key)}
            className={[
              "text-[13px] font-medium transition-colors whitespace-nowrap",
              numeric ? "tabular-nums" : "",
              sort === key
                ? "text-[var(--foreground)] font-bold"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {label}
            {sortIndicator(key)}
          </Link>
        ))}
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2" role="list" aria-label="MCP activity">
        {rows.map((row) => (
          <article
            key={row.userId}
            role="listitem"
            className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] px-5 py-3.5"
          >
            {/* Desktop: grid matching header */}
            <div
              className="hidden md:grid gap-3 items-center"
              style={{ gridTemplateColumns: "1fr 120px 72px 80px 88px 72px 96px" }}
            >
              <p className="text-[15px] font-bold text-[var(--foreground)] truncate leading-tight">
                {row.name}
              </p>
              <p className="text-[13px] text-[var(--muted-foreground)] truncate">
                {row.entity || "—"}
              </p>
              <p className="text-[14px] text-[var(--foreground)] tabular-nums">
                {row.totalPosts}
              </p>
              <p className="text-[14px] font-medium text-[var(--foreground)] tabular-nums">
                {row.postsThisWeek}
              </p>
              <p className="text-[14px] text-[var(--foreground)] tabular-nums">
                {row.postsThisMonth}
              </p>
              <p
                className={[
                  "text-[14px] tabular-nums",
                  row.pending > 0
                    ? "text-[var(--destructive)] font-medium"
                    : "text-[var(--foreground)]",
                ].join(" ")}
              >
                {row.pending}
              </p>
              <p className="text-[13px] text-[var(--muted-foreground)]">
                {row.lastPost ? relativeTime(row.lastPost) : "—"}
              </p>
            </div>

            {/* Mobile: stacked */}
            <div className="md:hidden flex flex-col gap-0.5">
              <p className="text-[15px] font-bold text-[var(--foreground)] truncate leading-tight">
                {row.name}
                {row.entity && (
                  <span className="ml-1.5 text-[13px] font-normal text-[var(--muted-foreground)]">
                    · {row.entity}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[13px] text-[var(--muted-foreground)]">
                <span>
                  <span className="text-[var(--foreground)] font-medium tabular-nums">
                    {row.postsThisWeek}
                  </span>{" "}
                  this week
                </span>
                <span>
                  <span className="text-[var(--foreground)] tabular-nums">
                    {row.totalPosts}
                  </span>{" "}
                  total
                </span>
                {row.pending > 0 && (
                  <span className="text-[var(--destructive)] font-medium tabular-nums">
                    {row.pending} pending
                  </span>
                )}
                {row.lastPost && <span>{relativeTime(row.lastPost)}</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
