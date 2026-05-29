"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ActivitySearchProps {
  q: string;
  sort: string;
  dir: string;
  limit: number;
}

export function ActivitySearch({ q, sort, dir, limit }: ActivitySearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(q);

  function buildParams(search: string) {
    const params = new URLSearchParams();
    if (sort !== "postsThisWeek") params.set("sort", sort);
    if (dir !== "desc") params.set("dir", dir);
    if (search) params.set("q", search);
    if (limit !== 25) params.set("limit", String(limit));
    return params.toString();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qs = buildParams(value.trim());
    router.push(`/admin/activity${qs ? `?${qs}` : ""}`);
  }

  function handleClear() {
    setValue("");
    const qs = buildParams("");
    router.push(`/admin/activity${qs ? `?${qs}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search name or entity…"
        aria-label="Search MCPs by name or entity"
        className="h-8 w-56 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
      />
      <button
        type="submit"
        className="h-8 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[14px] font-medium text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors cursor-pointer"
      >
        Search
      </button>
      {q && (
        <button
          type="button"
          onClick={handleClear}
          className="text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          Clear
        </button>
      )}
    </form>
  );
}
