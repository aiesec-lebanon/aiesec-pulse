"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [10, 25, 50, 100] as const;

export function PageSizeSelect({ current }: { current: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(newLimit: number) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("limit", String(newLimit));
    p.delete("page");
    p.delete("cursor");
    p.delete("ucursor");
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-[var(--muted-foreground)] whitespace-nowrap">Per page</span>
      <select
        value={current}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[14px] text-[var(--foreground)] px-2 pr-6 cursor-pointer focus:outline-none focus:border-[var(--primary)] transition-colors"
        aria-label="Rows per page"
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
