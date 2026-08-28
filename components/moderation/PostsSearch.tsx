"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface PostsSearchProps {
  q: string;
  status: string;
  limit: number;
}

export function PostsSearch({ q, status, limit }: PostsSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(q);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (value.trim()) params.set("q", value.trim());
    if (limit !== 25) params.set("limit", String(limit));
    const qs = params.toString();
    router.push(`/moderation/posts${qs ? `?${qs}` : ""}`);
  }

  function handleClear() {
    setValue("");
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (limit !== 25) params.set("limit", String(limit));
    const qs = params.toString();
    router.push(`/moderation/posts${qs ? `?${qs}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search title or author…"
        aria-label="Search posts by title or author"
        className="h-11 w-56 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-[14px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] transition-colors focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      />
      <button
        type="submit"
        className="min-h-[36px] cursor-pointer rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-[14px] font-medium text-[color:var(--muted-foreground)] transition-colors hover:border-[var(--primary)] hover:text-[color:var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        Search
      </button>
      {q && (
        <button
          type="button"
          onClick={handleClear}
          className="rounded-[var(--radius-sm)] text-[13px] text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          Clear
        </button>
      )}
    </form>
  );
}
