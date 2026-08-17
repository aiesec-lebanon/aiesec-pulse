"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { revokeRoleGrant } from "@/app/actions/roles";

export type GrantRow = {
  id: string;
  memberName: string;
  memberEmail: string | null;
  roleKey: string;
  roleName: string;
  scopeName: string;
  termLabel: string | null;
  startsAt: string;
  endsAt: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "No end date";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function GrantsTable({ rows }: { rows: GrantRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<GrantRow | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmRevoke() {
    if (!target) return;
    if (reason.trim().length < 5) {
      setError("Record why this grant is being revoked.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await revokeRoleGrant(target.id, reason);
      if (result.ok) {
        setTarget(null);
        setReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <div className="aiesec-card overflow-x-auto p-0">
        <table className="w-full text-left">
          <caption className="sr-only">Active manually granted roles</caption>
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th
                scope="col"
                className="px-4 py-3 text-[14px] font-medium text-[var(--muted-foreground)]"
              >
                Member
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-[14px] font-medium text-[var(--muted-foreground)]"
              >
                Role
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-[14px] font-medium text-[var(--muted-foreground)]"
              >
                Scope
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-[14px] font-medium text-[var(--muted-foreground)]"
              >
                Term
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-[14px] font-medium text-[var(--muted-foreground)]"
              >
                Ends
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-[14px] font-medium text-[var(--muted-foreground)]"
              >
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">
                  <p className="text-[15px] text-[var(--foreground)]">{row.memberName}</p>
                  {row.memberEmail && (
                    <p className="text-[13px] text-[var(--muted-foreground)]">{row.memberEmail}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-[14px] text-[var(--foreground)]">{row.roleName}</td>
                <td className="px-4 py-3 text-[14px] text-[var(--muted-foreground)]">
                  {row.scopeName}
                </td>
                <td className="px-4 py-3 text-[14px] tabular-nums text-[var(--muted-foreground)]">
                  {row.termLabel ?? "—"}
                </td>
                <td className="px-4 py-3 text-[14px] text-[var(--muted-foreground)]">
                  {formatDate(row.endsAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setTarget(row);
                      setReason("");
                      setError(null);
                    }}
                    className="min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[14px] font-bold text-[var(--muted-foreground)] transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    Revoke
                    <span className="sr-only">
                      {" "}
                      {row.roleName} for {row.memberName}
                    </span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-title"
            className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6"
          >
            <h2 id="revoke-title" className="text-[18px] font-bold text-[var(--foreground)]">
              Revoke {target.roleName}?
            </h2>
            <p className="mt-2 text-[14px] leading-[1.5] text-[var(--muted-foreground)]">
              {target.memberName} loses this role within a minute. The grant is kept in the record
              as revoked, not deleted.
            </p>

            <label
              htmlFor="revoke-reason"
              className="mb-1.5 mt-4 block text-[14px] font-medium text-[var(--foreground)]"
            >
              Reason{" "}
              <span aria-hidden className="text-[var(--destructive-text)]">
                *
              </span>
            </label>
            <textarea
              id="revoke-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[15px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
            />
            {error && (
              <p role="alert" className="mt-1 text-[13px] text-[var(--destructive-text)]">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTarget(null)}
                disabled={pending}
                className="aiesec-btn-secondary min-h-[36px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRevoke}
                disabled={pending}
                className="min-h-[36px] rounded-[var(--radius-sm)] bg-[var(--destructive-text)] px-4 py-2 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {pending ? "Revoking…" : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
