"use client";

import type { TopicOption } from "@/lib/content/topics";

type Props = {
  topics: TopicOption[];
  selectedIds: string[];
  onChange: (_ids: string[]) => void;
  disabled?: boolean;
};

export function TopicPicker({ topics, selectedIds, onChange, disabled }: Props) {
  if (topics.length === 0) return null;

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div>
      <p className="mb-1.5 text-[14px] font-medium text-[color:var(--foreground)]">
        Topics <span className="font-normal text-[color:var(--muted-foreground)]">(optional)</span>
      </p>
      <div role="group" aria-label="Topics" className="flex flex-wrap gap-2">
        {topics.map((topic) => {
          const active = selectedIds.includes(topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => toggle(topic.id)}
              className={[
                "rounded-[3px] border px-3.5 py-2 text-[13px] font-medium tracking-[0.02em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50",
                active
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[color:var(--primary-text)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[color:var(--muted-foreground)] hover:border-[var(--primary)]/60 hover:text-[color:var(--foreground)]",
              ].join(" ")}
            >
              {topic.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
