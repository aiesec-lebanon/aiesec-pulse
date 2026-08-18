"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { searchEntities } from "@/app/actions/entities";
import type { EntitySearchResult } from "@/lib/org/entities";

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

const SEARCH_DEBOUNCE_MS = 300;

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
        <p className="mb-1.5 text-[14px] font-medium text-[var(--foreground)]">Audience</p>
        <p className="text-[15px] text-[var(--muted-foreground)]">
          This post will reach{" "}
          <span className="font-medium text-[var(--foreground)]">{options.label}</span>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1.5 text-[14px] font-medium text-[var(--foreground)]">Audience</p>

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
                  ? "bg-[var(--card)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
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
            className="h-11 w-full max-w-[320px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-[16px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
            value={value}
            onChange={onChange}
            disabled={disabled}
            describedBy={error ? "audience-error" : undefined}
          />
        </div>
      )}

      {error && (
        <p
          id="audience-error"
          role="alert"
          className="mt-1.5 text-[13px] text-[var(--destructive-text)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function EntityTypeahead({
  value,
  onChange,
  disabled,
  describedBy,
}: {
  value: AudienceValue;
  onChange: (value: AudienceValue) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const [query, setQuery] = useState(value.entityLabel ?? "");
  const [results, setResults] = useState<EntitySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const requestIdRef = useRef(0);

  // Once an entity is picked, the input shows its name rather than a live
  // query — typing again clears the pick, the same escape hatch a browser's
  // own autocomplete gives you.
  useEffect(() => {
    if (value.entityId && value.entityLabel && query === value.entityLabel) return;
    // A short or just-selected query does nothing here — stale `results` from
    // a longer query are simply not rendered below rather than cleared via a
    // synchronous setState in the effect body.
    if (!query.trim() || query.length < 2 || query === value.entityLabel) return;

    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const found = await searchEntities(query);
        if (requestId === requestIdRef.current) setResults(found);
      } finally {
        if (requestId === requestIdRef.current) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function pick(entity: EntitySearchResult) {
    setQuery(entity.name);
    setResults([]);
    onChange({ scopeType: "ENTITY", entityId: entity.id, entityLabel: entity.name });
  }

  function clear() {
    setQuery("");
    setResults([]);
    onChange({ scopeType: "ENTITY", entityId: null, entityLabel: null });
  }

  return (
    <div className="max-w-[400px]">
      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value.entityId)
              onChange({ scopeType: "ENTITY", entityId: null, entityLabel: null });
          }}
          placeholder="Search for an MC or LC by name…"
          aria-label="Search for an entity"
          aria-describedby={describedBy}
          autoComplete="off"
          className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 pr-9 text-[16px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          {isSearching ? (
            <Loader2
              size={16}
              strokeWidth={2}
              className="animate-spin text-[var(--muted-foreground)]"
            />
          ) : value.entityId ? (
            <Check size={16} strokeWidth={2.5} className="text-[var(--success-text)]" aria-hidden />
          ) : null}
        </span>
        {query && !disabled && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear entity selection"
            className="absolute right-9 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:flex"
          >
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {query.trim().length >= 2 && query !== value.entityLabel && results.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-1">
          {results.map((entity) => (
            <li key={entity.id}>
              <button
                type="button"
                onClick={() => pick(entity)}
                className="flex w-full min-h-[36px] items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-[14px] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                <span className="truncate">{entity.name}</span>
                {entity.tag && (
                  <span className="shrink-0 text-[12px] text-[var(--muted-foreground)]">
                    {entity.tag}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length >= 2 && !isSearching && results.length === 0 && !value.entityId && (
        <p className="mt-1.5 text-[13px] text-[var(--muted-foreground)]">
          No matching entity found.
        </p>
      )}
    </div>
  );
}
