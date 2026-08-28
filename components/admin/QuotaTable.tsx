"use client";

import { useId, useState, useTransition } from "react";

import { removeQuotaOverride, setQuotaPolicy } from "@/app/actions/quotas";
import type { PostLevel, QuotaPeriod } from "@/app/generated/prisma/enums";
import { MAX_BUDGET, PERIOD_NAMES } from "@/lib/quota-shared";
import { ROLE_NAMES, type RoleKey } from "@/lib/rbac/catalogue";

export type QuotaRow = {
  /** Null when no policy exists yet: the class holds the permission but has
   *  no allowance — a refusal to publish, not a free hand. */
  policyId: string | null;
  roleKey: RoleKey;
  postLevel: PostLevel;
  period: QuotaPeriod;
  maxPosts: number;
};

export type QuotaGroup = { level: PostLevel; label: string; rows: QuotaRow[] };

const PERIODS = Object.keys(PERIOD_NAMES) as QuotaPeriod[];

/**
 * The budget grid, shaped like the permission matrix: one table in the
 * admin card shell, rows banded by what they govern.
 *
 * Every edit here is explicit, unlike the matrix's optimistic toggle: a
 * checkbox has one meaning, so a round trip feels broken, but a number
 * doesn't — a half-typed budget is a different budget, and saving on each
 * keystroke would write three wrong policies before the right one.
 */
export function QuotaTable({
  caption,
  groups,
  entityId = null,
  removable = false,
}: {
  caption: string;
  groups: QuotaGroup[];
  /** The MC this table administers, or null for the network-wide defaults. */
  entityId?: string | null;
  removable?: boolean;
}) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {error && (
        <p role="alert" className="mb-3 text-[14px] text-[color:var(--destructive-text)]">
          {error}
        </p>
      )}

      <div className="aiesec-card overflow-x-auto p-0">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th
                scope="col"
                className="px-4 py-3 text-[14px] font-medium text-[color:var(--muted-foreground)]"
              >
                Position class
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-[14px] font-medium text-[color:var(--muted-foreground)]"
              >
                Period
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-[14px] font-medium text-[color:var(--muted-foreground)]"
              >
                Budget
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          {groups.map((group) => (
            <tbody key={group.level}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={4}
                  className="pulse-label bg-[var(--muted)] px-4 py-2 text-left"
                >
                  {group.label}
                </th>
              </tr>
              {group.rows.length === 0 ? (
                <tr className="border-b border-[var(--border)] last:border-0">
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-[14px] text-[color:var(--muted-foreground)]"
                  >
                    No class holds this permission, so no budget applies.
                  </td>
                </tr>
              ) : (
                group.rows.map((row) => (
                  <QuotaTableRow
                    key={`${row.roleKey}:${row.postLevel}`}
                    row={row}
                    entityId={entityId}
                    removable={removable}
                    onSaved={setStatus}
                    onFailed={setError}
                    onClearError={() => setError(null)}
                  />
                ))
              )}
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}

function QuotaTableRow({
  row,
  entityId,
  removable,
  onSaved,
  onFailed,
  onClearError,
}: {
  row: QuotaRow;
  entityId: string | null;
  removable: boolean;
  onSaved: (message: string) => void;
  onFailed: (message: string) => void;
  onClearError: () => void;
}) {
  const fieldId = useId();
  const [maxPosts, setMaxPosts] = useState(row.policyId ? String(row.maxPosts) : "");
  const [period, setPeriod] = useState<QuotaPeriod>(row.period);
  const [pending, startTransition] = useTransition();

  const parsed = Number(maxPosts);
  const valid = maxPosts !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_BUDGET;
  const dirty = !row.policyId || parsed !== row.maxPosts || period !== row.period;

  function save() {
    if (!valid) return;
    onClearError();
    startTransition(async () => {
      const result = await setQuotaPolicy({
        roleKey: row.roleKey,
        postLevel: row.postLevel,
        entityId,
        period,
        maxPosts: parsed,
      });
      if (result.ok) {
        onSaved(
          `${ROLE_NAMES[row.roleKey]} budget saved: ${parsed} ${PERIOD_NAMES[period].toLowerCase()}.`
        );
      } else {
        onFailed(result.error);
      }
    });
  }

  function remove() {
    if (!row.policyId) return;
    onClearError();
    startTransition(async () => {
      const result = await removeQuotaOverride(row.policyId!);
      if (result.ok) onSaved(`${ROLE_NAMES[row.roleKey]} override removed.`);
      else onFailed(result.error);
    });
  }

  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <th scope="row" className="px-4 py-3 text-[14px] font-medium text-[color:var(--foreground)]">
        <span className="block whitespace-nowrap">{ROLE_NAMES[row.roleKey]}</span>
        {!row.policyId && (
          <span className="block text-[12px] font-medium text-[color:var(--destructive-text)]">
            No budget set — cannot publish
          </span>
        )}
      </th>

      <td className="px-4 py-3">
        <label className="sr-only" htmlFor={`${fieldId}-period`}>
          Period for {ROLE_NAMES[row.roleKey]}
        </label>
        <select
          id={`${fieldId}-period`}
          value={period}
          disabled={pending}
          onChange={(e) => setPeriod(e.target.value as QuotaPeriod)}
          className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-[15px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {PERIODS.map((key) => (
            <option key={key} value={key}>
              {PERIOD_NAMES[key]}
            </option>
          ))}
        </select>
      </td>

      <td className="px-4 py-3">
        <label className="sr-only" htmlFor={`${fieldId}-budget`}>
          Budget for {ROLE_NAMES[row.roleKey]}
        </label>
        <input
          id={`${fieldId}-budget`}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_BUDGET}
          step={1}
          value={maxPosts}
          disabled={pending}
          aria-invalid={maxPosts !== "" && !valid ? true : undefined}
          onChange={(e) => setMaxPosts(e.target.value)}
          className="tabular h-11 w-24 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-[15px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
        />
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending || !valid || !dirty}
            className="aiesec-btn-secondary min-h-[36px] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
            <span className="sr-only"> {ROLE_NAMES[row.roleKey]} budget</span>
          </button>
          {removable && row.policyId && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:border-[var(--destructive)] hover:text-[color:var(--destructive-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
            >
              Remove
              <span className="sr-only"> the {ROLE_NAMES[row.roleKey]} override</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
