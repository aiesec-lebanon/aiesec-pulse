"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PostKind } from "@/app/generated/prisma/enums";
import { TopicPicker } from "@/components/composer/TopicPicker";
import type { TopicOption } from "@/lib/content/topics";
import { type FilterableEntity, KIND_LABELS } from "@/lib/search-shared";

const DATE_PRESETS = [
  { value: "", label: "Any time", days: null },
  { value: "7", label: "Past week", days: 7 },
  { value: "30", label: "Past month", days: 30 },
  { value: "365", label: "Past year", days: 365 },
] as const;

const selectClass =
  "h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 text-[14px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus:outline-none";
const labelClass = "flex flex-col gap-1";
const labelTextClass = "text-[13px] font-medium text-[color:var(--muted-foreground)]";

export type SearchFormInitial = {
  query: string;
  topicIds: string[];
  entityId: string;
  kind: PostKind | "";
  days: string;
};

type Props = {
  topics: TopicOption[];
  entities: FilterableEntity[];
  initial: SearchFormInitial;
};

// Search bar and filter bar: topics stay chips in selector mode;
// entity/kind/date all use the plain <select> pattern
// PageSizeSelect already established — no typeahead here, unlike the
// composer's AudiencePicker, and no native date-range input either. One
// explicit submit rather than navigating on every change, matching how the
// rest of the app treats a filter set as something you commit to.
export function SearchForm({ topics, entities, initial }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initial.query);
  const [topicIds, setTopicIds] = useState(initial.topicIds);
  const [entityId, setEntityId] = useState(initial.entityId);
  const [kind, setKind] = useState<PostKind | "">(initial.kind);
  const [days, setDays] = useState(initial.days);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (topicIds.length > 0) params.set("topics", topicIds.join(","));
    if (entityId) params.set("entity", entityId);
    if (kind) params.set("kind", kind);
    if (days) {
      const from = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
      params.set("from", from.toISOString());
    }
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="relative">
        <Search
          size={18}
          strokeWidth={2}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts…"
          aria-label="Search posts"
          className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] pl-10 pr-4 text-[16px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        {topics.length > 0 && (
          <div className="min-w-[240px] flex-1 basis-full">
            <TopicPicker topics={topics} selectedIds={topicIds} onChange={setTopicIds} />
          </div>
        )}

        <label className={labelClass}>
          <span className={labelTextClass}>Entity</span>
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            aria-label="Filter by entity"
            className={selectClass}
          >
            <option value="">Any entity</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.tag ? `${entity.name} (${entity.tag})` : entity.name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as PostKind | "")}
            aria-label="Filter by post type"
            className={selectClass}
          >
            <option value="">Any type</option>
            {(Object.entries(KIND_LABELS) as Array<[PostKind, string]>).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>Posted</span>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-label="Filter by date"
            className={selectClass}
          >
            {DATE_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="aiesec-btn-primary">
          Search
        </button>
      </div>
    </form>
  );
}
