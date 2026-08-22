// Split out for the same reason as lib/search-shared.ts: the topic colour is
// needed by client components, and lib/content/topics.ts is "server-only".

import type { TopicKind } from "@/app/generated/prisma/enums";

/**
 * Three accents, three kinds. The design system carries one colour per topic;
 * `Topic` carries no colour column, and adding one would put a design decision
 * in a migration and leave thirteen topics competing for three accents.
 *
 * Keying on `kind` means the code is learnable rather than arbitrary — blue is
 * a programme, teal is a function, orange is what the network decides
 * together — and it holds however many topics are seeded.
 */
export type TopicTone = "programme" | "function" | "general";

export const TOPIC_TONE: Record<TopicKind, TopicTone> = {
  PROGRAMME: "programme",
  FUNCTION: "function",
  GENERAL: "general",
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
 * The two letters a colour plate carries when a post has no cover. Initials of
 * the entity, not of the author: a plate stands for who published, and an
 * entity's initials stay the same while its officers rotate every year.
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
