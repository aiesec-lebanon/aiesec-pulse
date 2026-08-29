import type { TopicKind } from "@/app/generated/prisma/enums";

export type TopicTone = "programme" | "function" | "general";

export const TOPIC_TONE: Record<TopicKind, TopicTone> = {
  PROGRAMME: "programme",
  FUNCTION: "function",
  GENERAL: "general",
};

export const TOPIC_KIND_LABELS: Record<TopicKind, string> = {
  PROGRAMME: "Programme",
  FUNCTION: "Function",
  GENERAL: "General",
};

/** The four tokens a tone carries: the accent, its fill, the text that sits on
 *  that fill, and the derivative safe to use as text on the page ground. */
export type TopicTokens = {
  accent: string;
  fill: string;
  on: string;
  text: string;
};

export function topicTokens(tone: TopicTone): TopicTokens {
  return {
    accent: `var(--topic-${tone})`,
    fill: `var(--topic-${tone}-fill)`,
    on: `var(--topic-${tone}-on)`,
    text: `var(--topic-${tone}-text)`,
  };
}

export function tokensForKind(kind: TopicKind): TopicTokens {
  return topicTokens(TOPIC_TONE[kind]);
}

/**
 * Two-letter fallback plate for a post with no cover. Initials of the
 * entity, not the author — officers rotate yearly, the entity doesn't.
 */
export function initialsOf(name: string): string {
  const words = name
    .replace(/^AIESEC\s+(in\s+)?/i, "")
    .split(/[\s-]+/)
    .filter(Boolean);

  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
