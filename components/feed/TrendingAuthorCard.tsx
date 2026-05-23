type TrendingAuthorCardProps = {
  author: {
    id: string;
    fullName: string;
    committeeName: string | null;
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
  const mono = initials(author.fullName);

  return (
    <div className="flex w-80 shrink-0 snap-start flex-col justify-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-5">
      {/* Author identity */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 select-none items-center justify-center rounded-full bg-[var(--primary)] text-[14px] font-bold text-[var(--primary-foreground)]"
        >
          {mono}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-[var(--foreground)]">
            {author.fullName}
          </p>
          {author.committeeName && (
            <p className="truncate text-[13px] text-[var(--muted-foreground)]">
              {author.committeeName}
            </p>
          )}
        </div>
      </div>

      {/* Post-count pill */}
      <span className="inline-flex w-fit items-center rounded-[var(--radius-md)] bg-[var(--muted)] px-3 py-1 text-[12px] font-medium text-[var(--muted-foreground)]">
        {author.postCount}{" "}
        {author.postCount === 1 ? "post" : "posts"} this month
      </span>
    </div>
  );
}
