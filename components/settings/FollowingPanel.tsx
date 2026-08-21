"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { removeFollow } from "@/app/actions/follows";

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
      return; // removingId stays set — the row disappears once the refreshed list lands
    }
    setError(result.error);
    setRemovingId(null);
  }

  if (items.length === 0) {
    return (
      <p className="mt-6 text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
        You&apos;re not following or muting any topics or entities yet.
      </p>
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
      <div className="flex flex-col gap-2" role="list">
        {items.map((item) => (
          <article
            key={item.targetId}
            role="listitem"
            className="aiesec-card flex items-center gap-3 p-3"
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

            <span
              className={[
                "shrink-0 rounded-[var(--radius-md)] px-2 py-0.5 text-[12px] font-medium",
                item.muted
                  ? "bg-[var(--muted)] text-[color:var(--muted-foreground)]"
                  : "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[color:var(--primary-text)]",
              ].join(" ")}
            >
              {item.muted ? "Muted" : "Following"}
            </span>

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
