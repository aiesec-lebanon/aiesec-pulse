/**
 * A headline in the display serif, with one word set italic in an accent
 * colour.
 *
 * The accent is the signature device of the whole system: it names what a
 * story is about from inside the sentence rather than beside it. It is
 * deliberately opt-in — nothing picks the word automatically, because the
 * word that carries a headline is an editorial judgement and an algorithm
 * reaching for "the" or "a" would make every headline look accidental.
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
  /** A whole word from `title`. Ignored when it is not one. */
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
 */
export function splitOnWord(title: string, word: string | null | undefined): Split {
  const target = word?.trim();
  if (!target) return { before: title, accent: null, after: "" };

  const pattern = new RegExp(
    String.raw`(^|\s)(` + escapeRegExp(target) + String.raw`)(?=$|[\s.,;:!?'")’”])`,
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
