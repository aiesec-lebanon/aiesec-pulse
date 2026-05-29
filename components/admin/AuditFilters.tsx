"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AuditFiltersProps {
  filter: string;
  role: string;
  q: string;
  from: string;
  to: string;
  limit: number;
}

const ROLE_CHIPS = [
  { label: "All roles", value: "" },
  { label: "Admin", value: "admin" },
  { label: "MCP", value: "mcp" },
  { label: "Member", value: "member" },
] as const;

const ACTION_CHIPS = [
  { label: "All", value: "" },
  { label: "Approvals", value: "approvals" },
  { label: "Rejections", value: "rejections" },
  { label: "Deletions", value: "deletions" },
  { label: "Creations", value: "creations" },
] as const;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  return d.toISOString().slice(0, 10);
}

export function AuditFilters({ filter, role, q, from, to, limit }: AuditFiltersProps) {
  const router = useRouter();
  const [searchQ, setSearchQ] = useState(q);
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const base: Record<string, string | undefined> = {
      filter: filter || undefined,
      role: role || undefined,
      q: q || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: limit !== 25 ? String(limit) : undefined,
    };
    const merged = { ...base, page: undefined, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "") p.set(k, v);
    }
    const qs = p.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  function applySearchAndDate(e: React.FormEvent) {
    e.preventDefault();
    router.push(
      buildUrl({
        q: searchQ || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
    );
  }

  function applyPreset(days: number) {
    const f = daysAgo(days);
    const t = todayStr();
    setFromDate(f);
    setToDate(t);
    router.push(buildUrl({ from: f, to: t }));
  }

  function clearDates() {
    setFromDate("");
    setToDate("");
    router.push(buildUrl({ from: undefined, to: undefined }));
  }

  const today = todayStr();
  const isToday = from === today && to === today;
  const is7d = from === daysAgo(7) && to === today;
  const is30d = from === daysAgo(30) && to === today;
  const hasDateFilter = !!(from || to);

  const chipBase =
    "px-3 py-1.5 rounded-[var(--radius-md)] border text-[13px] font-medium transition-colors whitespace-nowrap";
  const chipActive =
    "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] border-[var(--primary)] text-[var(--primary)]";
  const chipInactive =
    "bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]";

  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* Row 1: Action type chips */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by action type"
      >
        {ACTION_CHIPS.map(({ label, value }) => (
          <Link
            key={value}
            href={buildUrl({ filter: value || undefined })}
            className={`${chipBase} ${filter === value ? chipActive : chipInactive}`}
            aria-current={filter === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Row 2: Role chips */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by role"
      >
        {ROLE_CHIPS.map(({ label, value }) => (
          <Link
            key={value}
            href={buildUrl({ role: value || undefined })}
            className={`${chipBase} ${role === value ? chipActive : chipInactive}`}
            aria-current={role === value ? "true" : undefined}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Row 3: Name search + date range */}
      <form
        onSubmit={applySearchAndDate}
        className="flex flex-wrap items-center gap-2"
      >
        {/* Name / email search */}
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search name or email…"
          aria-label="Search by name or email"
          className="h-8 w-48 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
        />

        {/* Date from */}
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          aria-label="From date"
          className="h-8 px-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[14px] text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
        />
        <span className="text-[13px] text-[var(--muted-foreground)]">–</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          aria-label="To date"
          className="h-8 px-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[14px] text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
        />

        {/* Quick presets */}
        <button
          type="button"
          onClick={() => applyPreset(1)}
          className={`${chipBase} ${isToday ? chipActive : chipInactive}`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => applyPreset(7)}
          className={`${chipBase} ${is7d ? chipActive : chipInactive}`}
        >
          7d
        </button>
        <button
          type="button"
          onClick={() => applyPreset(30)}
          className={`${chipBase} ${is30d ? chipActive : chipInactive}`}
        >
          30d
        </button>
        {hasDateFilter && (
          <button
            type="button"
            onClick={clearDates}
            className={`${chipBase} ${chipInactive}`}
          >
            Clear dates
          </button>
        )}

        {/* Apply button */}
        <button
          type="submit"
          className="h-8 px-4 rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--primary-foreground)] text-[14px] font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          Apply
        </button>
      </form>
    </div>
  );
}
