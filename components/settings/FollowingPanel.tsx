"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { removeFollow } from "@/app/actions/follows";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";

export type FollowingItem = {
  targetType: "TOPIC" | "ENTITY";
  targetId: string;
  muted: boolean;
  name: string;
  /** /topics/[slug] for topics; null for entities — no entity detail page exists yet. */
  href: string | null;
};

export function FollowingPanel({ items }: { items: FollowingItem[] }) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const topics = items.filter((i) => i.targetType === "TOPIC");
  const entities = items.filter((i) => i.targetType === "ENTITY");

  async function handleRemove(item: FollowingItem) {
    setRemovingId(item.targetId);
    setError(null);
    const result = await removeFollow(item.targetType, item.targetId);
    if (result.ok) {
      router.refresh();
      return; // stays set until the refreshed list replaces this row
    }
    setError(result.error);
    setRemovingId(null);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        eyebrow="Nothing followed"
        heading="You're not following or muting anything yet."
        body="Follow a topic or entity from its own page to see it here."
      />
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {topics.length > 0 && (
        <FollowGroup
          title="Topics"
          items={topics}
          removingId={removingId}
          onRemove={(item) => void handleRemove(item)}
        />
      )}
      {entities.length > 0 && (
        <FollowGroup
          title="Entities"
          items={entities}
          removingId={removingId}
          onRemove={(item) => void handleRemove(item)}
        />
      )}
      {error && (
        <p role="alert" className="text-[13px] text-[color:var(--destructive-text)]">
          {error}
        </p>
      )}
    </div>
  );
}

function FollowGroup({
  title,
  items,
  removingId,
  onRemove,
}: {
  title: string;
  items: FollowingItem[];
  removingId: string | null;
  onRemove: (item: FollowingItem) => void;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-[14px] font-bold text-[color:var(--foreground)]">{title}</h2>
      <div className="flex flex-col" role="list">
        {items.map((item) => (
          <article
            key={item.targetId}
            role="listitem"
            className="flex items-center gap-3 border-b border-[var(--hairline)] py-3 first:pt-0"
          >
            <div className="min-w-0 flex-1">
              {item.href ? (
                <Link
                  href={item.href}
                  className="truncate text-[14px] font-medium text-[color:var(--foreground)] hover:text-[color:var(--primary-text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                >
                  {item.name}
                </Link>
              ) : (
                <span className="truncate text-[14px] font-medium text-[color:var(--foreground)]">
                  {item.name}
                </span>
              )}
            </div>

            <Pill
              className="shrink-0"
              label={item.muted ? "Muted" : "Following"}
              tint={
                item.muted ? "var(--muted)" : "color-mix(in srgb, var(--primary) 10%, transparent)"
              }
              text={item.muted ? "var(--muted-foreground)" : "var(--primary-text)"}
            />

            <button
              type="button"
              onClick={() => onRemove(item)}
              disabled={removingId === item.targetId}
              className="min-h-[36px] shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:border-[var(--destructive)] hover:text-[color:var(--destructive-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {removingId === item.targetId ? "Removing…" : "Remove"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
