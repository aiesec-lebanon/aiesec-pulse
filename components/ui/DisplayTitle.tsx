/**
 * Headline in the display serif with one word/phrase set italic in an
 * accent colour (see lib/content/accent.ts). Accent is italic as well as
 * coloured so the emphasis survives without color.
 */
export function DisplayTitle({
  title,
  accentWord,
  accentColor,
  size = "lg",
  as: Tag = "h1",
  className,
  id,
}: {
  title: string;
  /** A whole word or phrase from `title`. Ignored when it is not present. */
  accentWord?: string | null;
  /** Any colour token. Defaults to the brand's text-safe blue. */
  accentColor?: string;
  size?: "xl" | "lg" | "md" | "sm";
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  /** For `aria-labelledby` pairing with the section it titles. */
  id?: string;
}) {
  const parts = splitOnWord(title, accentWord);

  return (
    <Tag
      id={id}
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
 * Whole-word match only (accenting "on" won't hit "long"); an absent word
 * leaves the title unchanged so a stale accent is harmless. Multi-word
 * targets match on \s+, so double-spaced pastes still hit.
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
