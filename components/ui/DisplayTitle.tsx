/**
 * A headline in the display serif, with one word — or one phrase — set italic
 * in an accent colour.
 *
 * The accent is the signature device of the whole system: it names what a
 * story is about from inside the sentence rather than beside it. It is
 * deliberately opt-in — nothing picks the word automatically, because the
 * word that carries a headline is an editorial judgement and an algorithm
 * reaching for "the" or "a" would make every headline look accidental. What a
 * caller *may* pass is a phrase the story is already filed under; see
 * `lib/content/accent.ts`.
 *
 * Multi-word accents are supported because 2a's own headline uses one ("nine
 * weeks", "rebuilt"), and because a topic name is rarely one word. Runs of
 * whitespace in the target are matched loosely, so a phrase still matches a
 * title that happens to wrap its words differently.
 *
 * Colour is never the only cue. The accent is italic as well as coloured, so
 * the emphasis survives for a reader who cannot see the hue.
 */
export function DisplayTitle({
  title,
  accentWord,
  accentColor,
  size = "lg",
  as: Tag = "h1",
  className,
}: {
  title: string;
  /** A whole word or phrase from `title`. Ignored when it is not present. */
  accentWord?: string | null;
  /** Any colour token. Defaults to the brand's text-safe blue. */
  accentColor?: string;
  size?: "xl" | "lg" | "md" | "sm";
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
}) {
  const parts = splitOnWord(title, accentWord);

  return (
    <Tag
      className={["pulse-serif pulse-balance", `pulse-serif-${size}`, "break-words", className]
        .filter(Boolean)
        .join(" ")}
    >
      {parts.before}
      {parts.accent && (
        <em
          className="pulse-serif-accent"
          style={accentColor ? { ["--accent-color" as string]: accentColor } : undefined}
        >
          {parts.accent}
        </em>
      )}
      {parts.after}
    </Tag>
  );
}

type Split = { before: string; accent: string | null; after: string };

/**
 * Matches whole words only, so accenting "on" cannot italicise the middle of
 * "long". Returns the title unchanged when the word is absent, which is what
 * makes a stale accent harmless after an edit.
 *
 * A multi-word target is matched with `\s+` between its words rather than a
 * literal space, so "AIESEC  in Brazil" in a pasted headline still matches
 * "AIESEC in Brazil".
 */
export function splitOnWord(title: string, word: string | null | undefined): Split {
  const target = word?.trim();
  if (!target) return { before: title, accent: null, after: "" };

  const pattern = new RegExp(
    String.raw`(^|\s)(` +
      escapeRegExp(target).replace(/\\?\s+/g, String.raw`\s+`) +
      String.raw`)(?=$|[\s.,;:!?'")’”])`,
    "i"
  );
  const match = pattern.exec(title);
  if (!match) return { before: title, accent: null, after: "" };

  const start = match.index + match[1].length;
  return {
    before: title.slice(0, start),
    accent: title.slice(start, start + match[2].length),
    after: title.slice(start + match[2].length),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
