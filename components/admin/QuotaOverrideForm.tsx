"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { searchMcEntities, setQuotaPolicy } from "@/app/actions/quotas";
import { PostLevel, type QuotaPeriod } from "@/app/generated/prisma/enums";
import { type EntityOption, EntityTypeahead } from "@/components/ui/EntityTypeahead";
import { MAX_BUDGET, PERIOD_NAMES } from "@/lib/quota-shared";
import { ROLE_NAMES, type RoleKey } from "@/lib/rbac/catalogue";

const PERIODS = Object.keys(PERIOD_NAMES) as QuotaPeriod[];

const LEVELS: Array<{ level: PostLevel; label: string }> = [
  { level: PostLevel.LOCAL, label: "Publishing" },
  { level: PostLevel.NETWORK, label: "Promotion" },
];

export function QuotaOverrideForm({
  rolesByLevel,
}: {
  rolesByLevel: Record<PostLevel, RoleKey[]>;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [entity, setEntity] = useState<EntityOption | null>(null);
  const [level, setLevel] = useState<PostLevel>(PostLevel.NETWORK);
  const [roleKey, setRoleKey] = useState<RoleKey | "">("");
  const [period, setPeriod] = useState<QuotaPeriod>("ISO_WEEK");
  const [maxPosts, setMaxPosts] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  const roles = rolesByLevel[level];
  const parsed = Number(maxPosts);
  const budgetValid =
    maxPosts !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_BUDGET;
  const ready = Boolean(entity) && roleKey !== "" && budgetValid;

  function submit() {
    if (!ready || !entity || !roleKey) return;
    setError(null);
    startTransition(async () => {
      const result = await setQuotaPolicy({
        roleKey,
        postLevel: level,
        entityId: entity.id,
        period,
        maxPosts: parsed,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus(`${ROLE_NAMES[roleKey]} in ${entity.name} now has ${parsed} per period.`);
      setEntity(null);
      setRoleKey("");
      setMaxPosts("");
      router.refresh();
    });
  }

  return (
    <div className="aiesec-card p-6">
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="flex flex-col gap-5">
        <div>
          <label
            htmlFor={`${fieldId}-entity`}
            className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
          >
            Member Committee
          </label>
          {/* Keyed on the selection so clearing it after a save resets the
              input's own text, which the typeahead owns. */}
          <EntityTypeahead
            key={entity?.id ?? "empty"}
            id={`${fieldId}-entity`}
            value={entity}
            onChange={setEntity}
            search={searchMcEntities}
            label="Member Committee"
            placeholder="Search for an MC by name…"
            emptyMessage="No matching MC found."
            disabled={pending}
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <label
              htmlFor={`${fieldId}-level`}
              className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
            >
              Budget
            </label>
            <select
              id={`${fieldId}-level`}
              value={level}
              disabled={pending}
              onChange={(e) => {
                setLevel(e.target.value as PostLevel);
                setRoleKey("");
              }}
              className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-[15px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {LEVELS.map((option) => (
                <option key={option.level} value={option.level}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`${fieldId}-role`}
              className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
            >
              Position class
            </label>
            <select
              id={`${fieldId}-role`}
              value={roleKey}
              disabled={pending || roles.length === 0}
              onChange={(e) => setRoleKey(e.target.value as RoleKey)}
              className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-[15px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                {roles.length === 0 ? "No class holds this permission" : "Choose a class…"}
              </option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_NAMES[role]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`${fieldId}-period`}
              className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
            >
              Period
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
          </div>

          <div>
            <label
              htmlFor={`${fieldId}-max`}
              className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
            >
              Posts allowed
            </label>
            <input
              id={`${fieldId}-max`}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_BUDGET}
              step={1}
              value={maxPosts}
              disabled={pending}
              aria-invalid={maxPosts !== "" && !budgetValid ? true : undefined}
              onChange={(e) => setMaxPosts(e.target.value)}
              className="tabular h-11 w-24 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-[15px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={pending || !ready}
            className="aiesec-btn-primary min-h-[36px] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Set the override"}
          </button>
          <p className="text-[13px] text-[color:var(--muted-foreground)]">
            An MC already carrying this budget has it replaced, not duplicated.
          </p>
        </div>

        <p role="alert" className="text-[13px] text-[color:var(--destructive-text)]">
          {error}
        </p>
      </div>
    </div>
  );
}
