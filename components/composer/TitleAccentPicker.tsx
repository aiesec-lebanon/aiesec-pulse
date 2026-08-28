"use client";

import { useMemo } from "react";

import type { TopicKind } from "@/app/generated/prisma/enums";
import { tokensForKind } from "@/lib/topics-shared";

/**
 * Choosing the phrase in a headline that goes italic in the topic's colour.
 * The choice must be editorial, never inferred — an algorithm picking the
 * phrase would make every headline look accidental.
 *
 * **Not** a text input for retyping part of the headline: it can be
 * misspelled, go stale when the title changes, and forces a diff. Selection
 * is enforced contiguous by construction — no gesture produces
 * "volunteers … town", which the renderer couldn't express anyway.
 *
 * Storage is the substring, not an index pair — see `Post.titleAccent`.
 * That lets an accent survive an edit elsewhere in the headline, and fail
 * silently (no accent), not loudly (wrong words), when it doesn't.
 */
export function TitleAccentPicker({
  title,
  value,
  onChange,
  topicKind,
}: {
  title: string;
  value: string;
  onChange: (next: string) => void;
  /** The selected topic's kind, so the swatch is the real accent colour. */
  topicKind: TopicKind | null;
}) {
  const words = useMemo(() => tokenise(title), [title]);

  // Which words the stored phrase currently covers. Derived rather than held in
  // state, so a title edit can never leave the chips disagreeing with the value.
  const selected = useMemo(() => selectedRange(words, value), [words, value]);

  const accentColor = topicKind ? tokensForKind(topicKind).text : "var(--primary-text)";

  if (words.length === 0) return null;

  function apply(range: { start: number; end: number } | null) {
    if (!range) {
      onChange("");
      return;
    }
    onChange(words.slice(range.start, range.end + 1).join(" "));
  }

  function toggle(index: number) {
    if (!selected) {
      apply({ start: index, end: index });
      return;
    }
    const { start, end } = selected;

    if (index === start && index === end) return apply(null);
    if (index === start) return apply({ start: start + 1, end });
    if (index === end) return apply({ start, end: end - 1 });
    if (index > start && index < end) return apply({ start: index, end: index });

    // Non-adjacent clicks start fresh — the accent must stay one contiguous
    // phrase, or the renderer can't express it.
    if (index === start - 1) return apply({ start: index, end });
    if (index === end + 1) return apply({ start, end: index });
    return apply({ start: index, end: index });
  }

  return (
    <fieldset className="mt-3">
      <legend className="mb-2 text-[13px] text-[color:var(--muted-foreground)]">
        Highlight a phrase{" "}
        <span className="text-[color:var(--muted-foreground)] opacity-70">(optional)</span> — tap
        words to set them in the topic&apos;s colour.
      </legend>

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {words.map((word, i) => {
          const on = selected !== null && i >= selected.start && i <= selected.end;
          return (
            <button
              key={`${i}-${word}`}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(i)}
              className={[
                "pulse-serif rounded-[3px] border px-1.5 py-0.5 text-[19px] leading-[1.25] transition-[background-color,border-color,color] duration-[calc(var(--dur-micro)*var(--motion-scale))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
                on
                  ? "border-[color-mix(in_srgb,currentColor_45%,transparent)] bg-[color-mix(in_srgb,currentColor_10%,transparent)] italic"
                  : "border-transparent text-[color:var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--muted)]",
              ].join(" ")}
              style={on ? { color: accentColor } : undefined}
            >
              {word}
            </button>
          );
        })}

        {selected && (
          <button
            type="button"
            onClick={() => apply(null)}
            className="pulse-label ml-1 min-h-[28px] rounded-[3px] px-2 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            Clear
          </button>
        )}
      </div>

      <span aria-live="polite" className="sr-only">
        {selected ? `Highlighting "${value}"` : "No phrase highlighted"}
      </span>
    </fieldset>
  );
}

/** Whitespace-separated words, in order. Punctuation rides with its word —
 *  matching what the renderer's whole-word match expects. */
function tokenise(title: string): string[] {
  return title.trim().split(/\s+/).filter(Boolean);
}

/**
 * Where the stored phrase sits in the current word list, or null when it no
 * longer appears — the honest answer after the author edits the headline
 * out from under it, and matches what the renderer does.
 */
function selectedRange(words: string[], value: string): { start: number; end: number } | null {
  const phrase = tokenise(value);
  if (phrase.length === 0) return null;

  for (let start = 0; start + phrase.length <= words.length; start++) {
    let matched = true;
    for (let offset = 0; offset < phrase.length; offset++) {
      if (words[start + offset] !== phrase[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return { start, end: start + phrase.length - 1 };
  }
  return null;
}
