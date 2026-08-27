"use client";

import { useMemo } from "react";

import type { TopicKind } from "@/app/generated/prisma/enums";
import { tokensForKind } from "@/lib/topics-shared";

/**
 * Choosing the phrase in a headline that goes italic in the topic's colour.
 *
 * The design system's signature device (§0.3) is one accented phrase per
 * headline, and it is explicit that the choice is editorial and must never be
 * inferred — "an algorithm reaching for 'the' would make every headline look
 * accidental". So it has to be asked for. The question is how to ask without
 * turning a one-second decision into a form.
 *
 * **Not** a text input asking the author to retype part of their own headline:
 * that can be misspelled, can go stale the moment the title is edited, and
 * makes the author do the diffing. Instead the headline is dealt out as its own
 * words, and tapping a word selects it. Tapping a word next to the selection
 * extends it; tapping either end trims it back; tapping the selection's middle
 * clears it. Contiguity is enforced by construction — there is no gesture that
 * produces "volunteers … town", which the renderer could not express anyway.
 *
 * Each chip shows what it will look like, in the topic's own colour, so the
 * decision is made by looking rather than by imagining. The whole control
 * disappears when there is no headline yet: an empty row of chips inviting a
 * choice about nothing is worse than no control.
 *
 * Storage is the substring, not an index pair — see `Post.titleAccent`. That is
 * what makes an accent survive an edit elsewhere in the headline and fail
 * silently (no accent) rather than loudly (the wrong words) when it does not.
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

    // Trim from either end. Clicking the only selected word clears it.
    if (index === start && index === end) return apply(null);
    if (index === start) return apply({ start: start + 1, end });
    if (index === end) return apply({ start, end: end - 1 });

    // Inside the selection: the author is starting again from this word.
    if (index > start && index < end) return apply({ start: index, end: index });

    // Adjacent: extend. Anything further away starts a fresh selection, because
    // the accent has to be one contiguous phrase.
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

/** Whitespace-separated words, in order. Punctuation rides along with its word,
 *  which is what the renderer's own whole-word match expects. */
function tokenise(title: string): string[] {
  return title.trim().split(/\s+/).filter(Boolean);
}

/**
 * Where the stored phrase sits in the current word list, or null when it no
 * longer appears — which is the honest answer after the author edits the
 * headline out from under it, and matches what the renderer does.
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
