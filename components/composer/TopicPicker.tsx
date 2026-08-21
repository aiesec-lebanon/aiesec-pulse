"use client";

import type { TopicOption } from "@/lib/content/topics";

type Props = {
  topics: TopicOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

/** Filter chips in selector mode — picking a topic is "activating a filter." */
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
                "rounded-[var(--radius-md)] border px-3 py-1.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50",
                active
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[color:var(--primary-text)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[color:var(--foreground)] hover:border-[var(--primary)]/60",
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
