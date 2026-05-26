"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type FilterMode = "recent" | "post";

interface CommentsFilterRowProps {
  mode: FilterMode;
  postId: string;
}

function parsePostRef(raw: string): string {
  const trimmed = raw.trim();
  // Extract from URLs containing /posts/<id>
  const match = trimmed.match(/\/posts\/([^/?#\s]+)/);
  if (match) return match[1];
  return trimmed;
}

export function CommentsFilterRow({ mode, postId }: CommentsFilterRowProps) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState(postId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = parsePostRef(inputValue);
    if (!id) return;
    router.push(`/admin/comments?filter=post&postId=${encodeURIComponent(id)}`);
  }

  const chipBase =
    "px-3 py-1.5 rounded-[var(--radius-md)] border text-[14px] font-medium transition-colors";
  const chipActive =
    "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] border-[var(--primary)] text-[var(--primary)]";
  const chipInactive =
    "bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]";

  return (
    <div
      className="flex flex-wrap items-center gap-3 mb-6"
      role="group"
      aria-label="Filter comments"
    >
      {/* Recent chip — Link for instant navigation */}
      <Link
        href="/admin/comments"
        className={`${chipBase} ${mode === "recent" ? chipActive : chipInactive}`}
        aria-current={mode === "recent" ? "page" : undefined}
      >
        Recent across all posts
      </Link>

      {/* By post section */}
      <span
        className={`${chipBase} ${mode === "post" ? chipActive : chipInactive} cursor-default`}
        aria-hidden="true"
      >
        By post
      </span>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Post URL or ID"
          aria-label="Filter by post URL or ID"
          className="h-8 w-52 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
        />
        <button
          type="submit"
          className="h-8 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[14px] font-medium text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors cursor-pointer"
        >
          Go
        </button>
      </form>
    </div>
  );
}
