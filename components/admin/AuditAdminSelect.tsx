"use client";

import { useRouter } from "next/navigation";

interface AuditAdminSelectProps {
  admins: { id: string; email: string }[];
  currentAdminId: string;
  currentFilter: string;
}

export function AuditAdminSelect({
  admins,
  currentAdminId,
  currentFilter,
}: AuditAdminSelectProps) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const q = new URLSearchParams();
    if (currentFilter) q.set("filter", currentFilter);
    if (e.target.value) q.set("adminId", e.target.value);
    // cursor intentionally omitted — filter change resets to page 1
    const qs = q.toString();
    router.push(`/admin/audit${qs ? `?${qs}` : ""}`);
  }

  return (
    <select
      value={currentAdminId}
      onChange={handleChange}
      aria-label="Filter by admin"
      className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[14px] text-[var(--foreground)] px-2 pr-8 cursor-pointer focus:outline-none focus:border-[var(--primary)] transition-colors"
    >
      <option value="">All admins</option>
      {admins.map((a) => (
        <option key={a.id} value={a.id}>
          {a.email}
        </option>
      ))}
    </select>
  );
}
