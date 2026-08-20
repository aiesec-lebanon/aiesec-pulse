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
    router.push(`/admin/posts${qs ? `?${qs}` : ""}`);
  }

  function handleClear() {
    setValue("");
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (limit !== 25) params.set("limit", String(limit));
    const qs = params.toString();
    router.push(`/admin/posts${qs ? `?${qs}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search title or author…"
        aria-label="Search posts by title or author"
        className="h-8 w-56 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[14px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
      />
      <button
        type="submit"
        className="h-8 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[14px] font-medium text-[color:var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[color:var(--primary-text)] transition-colors cursor-pointer"
      >
        Search
      </button>
      {q && (
        <button
          type="button"
          onClick={handleClear}
          className="text-[13px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
        >
          Clear
        </button>
      )}
    </form>
  );
}
