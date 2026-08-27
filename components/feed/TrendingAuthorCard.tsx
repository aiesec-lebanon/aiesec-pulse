import { EntityName } from "@/components/ui/EntityName";

type TrendingAuthorCardProps = {
  author: {
    id: string;
    fullName: string;
    entityName: string | null;
    postCount: number;
  };
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

export function TrendingAuthorCard({ author }: TrendingAuthorCardProps) {
  return (
    <div className="pulse-plate group relative flex w-[280px] shrink-0 snap-start items-center gap-4 overflow-hidden p-5">
      {/* A soft field keyed to the count, so a strip of cards has visible
          variation rather than reading as one repeated tile. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-[var(--glow-primary)] blur-2xl transition-opacity duration-[calc(var(--dur-element)*var(--motion-scale))] group-hover:opacity-100"
        style={{ opacity: Math.min(1, 0.35 + author.postCount * 0.12) }}
      />

      <span
        aria-hidden
        className="relative flex h-12 w-12 shrink-0 select-none items-center justify-center rounded-full bg-[var(--primary-fill)] text-[14px] font-bold text-[color:var(--primary-foreground)] shadow-[var(--elev-1)]"
      >
        {initials(author.fullName)}
      </span>

      <div className="relative min-w-0">
        <p className="truncate text-[15px] font-bold leading-tight text-[color:var(--foreground)]">
          {author.fullName}
        </p>
        {author.entityName && (
          <p className="mt-1 truncate text-[13px] text-[color:var(--muted-foreground)]">
            <EntityName name={author.entityName} />
          </p>
        )}
        <p className="tabular mt-2 text-[13px] text-[color:var(--muted-foreground)]">
          <span className="font-bold text-[color:var(--foreground)]">{author.postCount}</span>{" "}
          {author.postCount === 1 ? "post" : "posts"} this month
        </p>
      </div>
    </div>
  );
}
