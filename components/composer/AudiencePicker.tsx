"use client";

import { searchEntities } from "@/app/actions/entities";
import { EntityTypeahead } from "@/components/ui/EntityTypeahead";

export type AudiencePickerOptions =
  | { kind: "fixed"; label: string }
  | { kind: "open"; regions: Array<{ id: string; name: string }> };

export type AudienceValue = {
  scopeType: "GLOBAL" | "REGION" | "ENTITY";
  entityId: string | null;
  entityLabel: string | null;
};

export const DEFAULT_AUDIENCE_VALUE: AudienceValue = {
  scopeType: "GLOBAL",
  entityId: null,
  entityLabel: null,
};

type Props = {
  options: AudiencePickerOptions;
  value: AudienceValue;
  onChange: (value: AudienceValue) => void;
  error?: string;
  disabled?: boolean;
};

const SCOPE_OPTIONS: Array<{ key: AudienceValue["scopeType"]; label: string }> = [
  { key: "GLOBAL", label: "Everyone" },
  { key: "REGION", label: "A region" },
  { key: "ENTITY", label: "A specific entity" },
];

/**
 * Restricted publishers (entity_publisher/entity_editor) have no real choice
 * — context.md §7.2's "target audience beyond own scope: ❌" — so this is
 * information, not a control, for them. Publishers holding post.target_beyond
 * get the full picker. New pattern, no existing §7/§10 precedent to cite:
 * documented in AIESEC-Design-System-Guidelines.md §10.12 alongside this,
 * its first use.
 */
export function AudiencePicker({ options, value, onChange, error, disabled }: Props) {
  if (options.kind === "fixed") {
    return (
      <div>
        <p className="mb-1.5 text-[14px] font-medium text-[color:var(--foreground)]">Audience</p>
        <p className="text-[15px] text-[color:var(--muted-foreground)]">
          This post will reach AIESEC in{" "}
          <span className="font-medium text-[color:var(--foreground)]">{options.label}</span>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1.5 text-[14px] font-medium text-[color:var(--foreground)]">Audience</p>

      <div
        aria-label="Audience scope"
        className="inline-flex gap-1 rounded-[var(--radius-md)] bg-[var(--muted)] p-1"
      >
        {SCOPE_OPTIONS.map((scope) => {
          const active = value.scopeType === scope.key;
          return (
            <button
              key={scope.key}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange({ scopeType: scope.key, entityId: null, entityLabel: null })}
              className={[
                "rounded-[var(--radius-sm)] px-3 py-1.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50",
                active
                  ? "bg-[var(--card)] text-[color:var(--foreground)]"
                  : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              ].join(" ")}
            >
              {scope.label}
            </button>
          );
        })}
      </div>

      {value.scopeType === "REGION" && (
        <div className="mt-3">
          <select
            value={value.entityId ?? ""}
            disabled={disabled}
            onChange={(e) => {
              const region = options.regions.find((r) => r.id === e.target.value);
              onChange({
                scopeType: "REGION",
                entityId: region?.id ?? null,
                entityLabel: region?.name ?? null,
              });
            }}
            aria-label="Choose a region"
            aria-describedby={error ? "audience-error" : undefined}
            className="h-11 w-full max-w-[320px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-[16px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="" disabled>
              {options.regions.length === 0 ? "No regions available yet" : "Select a region…"}
            </option>
            {options.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {value.scopeType === "ENTITY" && (
        <div className="mt-3">
          <EntityTypeahead
            value={
              value.entityId && value.entityLabel
                ? { id: value.entityId, name: value.entityLabel, tag: null }
                : null
            }
            onChange={(entity) =>
              onChange({
                scopeType: "ENTITY",
                entityId: entity?.id ?? null,
                entityLabel: entity?.name ?? null,
              })
            }
            search={searchEntities}
            label="Search for an entity"
            placeholder="Search for an MC or LC by name…"
            disabled={disabled}
            describedBy={error ? "audience-error" : undefined}
          />
        </div>
      )}

      {error && (
        <p
          id="audience-error"
          role="alert"
          className="mt-1.5 text-[13px] text-[color:var(--destructive-text)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
