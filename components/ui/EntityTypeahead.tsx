"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type EntityOption = { id: string; name: string; tag: string | null };

const SEARCH_DEBOUNCE_MS = 300;

/** A single keystroke would scan the whole table; two narrow it usefully. */
const MIN_QUERY_LENGTH = 2;

/**
 * Shared by the composer's audience picker and the quota admin form
 * against different search functions — `search` is a prop, not an import.
 * Must be a stable reference (module-level action, not an inline closure):
 * the debounce effect only watches `query`, so an unstable fn goes stale.
 */
export function EntityTypeahead({
  id,
  value,
  onChange,
  search,
  label,
  placeholder,
  emptyMessage = "No matching entity found.",
  describedBy,
  disabled,
  className,
}: {
  /** Set it when a visible <label htmlFor> sits above; `label` must then say
   *  the same thing, or the accessible name contradicts what is on screen. */
  id?: string;
  value: EntityOption | null;
  onChange: (entity: EntityOption | null) => void;
  search: (query: string) => Promise<EntityOption[]>;
  /** Accessible name for the input. */
  label: string;
  placeholder: string;
  emptyMessage?: string;
  describedBy?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<EntityOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const requestIdRef = useRef(0);

  // Skips re-searching once `query` matches the picked value's name; typing
  // again clears the pick (onChange(null) below) and resumes search.
  useEffect(() => {
    if (value && query === value.name) return;
    if (query.trim().length < MIN_QUERY_LENGTH) return;

    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const found = await search(query);
        if (requestId === requestIdRef.current) setResults(found);
      } finally {
        if (requestId === requestIdRef.current) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function pick(entity: EntityOption) {
    setQuery(entity.name);
    setResults([]);
    onChange(entity);
  }

  function clear() {
    setQuery("");
    setResults([]);
    onChange(null);
  }

  const searchable = query.trim().length >= MIN_QUERY_LENGTH && query !== value?.name;

  return (
    <div className={className ?? "max-w-[400px]"}>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange(null);
          }}
          placeholder={placeholder}
          aria-label={label}
          aria-describedby={describedBy}
          autoComplete="off"
          className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 pr-9 text-[16px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          {isSearching ? (
            <Loader2
              size={16}
              strokeWidth={2}
              className="animate-spin pulse-ambient text-[color:var(--muted-foreground)]"
            />
          ) : value ? (
            <Check
              size={16}
              strokeWidth={2.5}
              className="text-[color:var(--success-text)]"
              aria-hidden
            />
          ) : null}
        </span>
        {query && !disabled && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear selection"
            className="absolute right-8 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:flex"
          >
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {searchable && results.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-1">
          {results.map((entity) => (
            <li key={entity.id}>
              <button
                type="button"
                onClick={() => pick(entity)}
                className="flex min-h-[36px] w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-[14px] text-[color:var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                <span className="truncate">{entity.name}</span>
                {entity.tag && (
                  <span className="shrink-0 text-[12px] text-[color:var(--muted-foreground)]">
                    {entity.tag}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {searchable && !isSearching && results.length === 0 && (
        <p className="mt-1.5 text-[13px] text-[color:var(--muted-foreground)]">{emptyMessage}</p>
      )}
    </div>
  );
}
