"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { createTopic } from "@/app/actions/topics";
import { TopicKind } from "@/app/generated/prisma/enums";
import { slugBase } from "@/lib/slug";
import { TOPIC_KIND_LABELS } from "@/lib/topics-shared";

const KINDS = Object.values(TopicKind);
const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 200;

export function TopicForm() {
  const router = useRouter();
  const fieldId = useId();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TopicKind>(TopicKind.GENERAL);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  const trimmedName = name.trim();
  const slugPreview = slugBase(trimmedName, 40);
  const ready =
    trimmedName.length > 0 && trimmedName.length <= MAX_NAME_LENGTH && slugPreview !== "";

  function submit() {
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      const result = await createTopic({
        name: trimmedName,
        kind,
        description: description.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus(`${trimmedName} added.`);
      setName("");
      setKind(TopicKind.GENERAL);
      setDescription("");
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
            htmlFor={`${fieldId}-name`}
            className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
          >
            Name
          </label>
          <input
            id={`${fieldId}-name`}
            type="text"
            value={name}
            disabled={pending}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sustainability"
            className="h-11 w-full max-w-sm rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-[15px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="mt-1.5 text-[13px] text-[color:var(--muted-foreground)]">
            {slugPreview ? (
              <>
                Will appear at <span className="tabular">/topics/{slugPreview}</span>
              </>
            ) : (
              "Enter a name to see its URL."
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <label
              htmlFor={`${fieldId}-kind`}
              className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
            >
              Kind
            </label>
            <select
              id={`${fieldId}-kind`}
              value={kind}
              disabled={pending}
              onChange={(e) => setKind(e.target.value as TopicKind)}
              className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-[15px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {KINDS.map((value) => (
                <option key={value} value={value}>
                  {TOPIC_KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[240px] flex-1">
            <label
              htmlFor={`${fieldId}-description`}
              className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
            >
              Description{" "}
              <span className="font-normal text-[color:var(--muted-foreground)]">(optional)</span>
            </label>
            <input
              id={`${fieldId}-description`}
              type="text"
              value={description}
              disabled={pending}
              maxLength={MAX_DESCRIPTION_LENGTH}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown as the standfirst on the topic's archive page"
              className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-[15px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
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
            {pending ? "Adding…" : "Add topic"}
          </button>
        </div>

        <p role="alert" className="text-[13px] text-[color:var(--destructive-text)]">
          {error}
        </p>
      </div>
    </div>
  );
}
