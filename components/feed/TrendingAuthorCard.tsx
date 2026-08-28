import { EntityName } from "@/components/ui/EntityName";

type TrendingAuthorCardProps = {
  author: {
    id: string;
    fullName: string;
    entityName: string | null;
    postCount: number;
  };
  /** Each card sits in its own `Reveal` wrapper, so Tailwind's `first:`
   *  can't see the rail's real first item — passed in explicitly instead. */
  isFirst?: boolean;
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TrendingAuthorCard({ author, isFirst = false }: TrendingAuthorCardProps) {
  return (
    <div
      className={[
        "flex w-[220px] shrink-0 snap-start items-center gap-3",
        isFirst ? "" : "border-l border-[var(--hairline)] pl-4",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-full bg-[var(--primary-fill)] text-[13px] font-bold text-[color:var(--primary-foreground)]"
      >
        {initials(author.fullName)}
      </span>

      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold leading-tight text-[color:var(--foreground)]">
          {author.fullName}
        </p>
        {author.entityName && (
          <p className="mt-0.5 truncate text-[12px] text-[color:var(--muted-foreground)]">
            <EntityName name={author.entityName} />
          </p>
        )}
        <p className="pulse-label mt-1">
          {author.postCount} {author.postCount === 1 ? "post" : "posts"}
        </p>
      </div>
    </div>
  );
}
