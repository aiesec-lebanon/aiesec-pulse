import type { TopicKind } from "@/app/generated/prisma/enums";
import { initialsOf, tokensForKind } from "@/lib/topics-shared";

/**
 * Fallback for posts with no cover art: topic-tinted field with the
 * entity's initials (aria-hidden — name's already on the card), instead
 * of a "missing image" placeholder. `kind` null means a neutral plate;
 * don't default to GENERAL, which would falsely imply a category.
 */
export function TopicPlate({
  entityName,
  kind,
  className,
}: {
  entityName: string;
  /** Null when the post carries no topic — see the note above. */
  kind: TopicKind | null;
  className?: string;
}) {
  const tokens = kind ? tokensForKind(kind) : null;

  const background = tokens
    ? // Corner-to-corner in the topic's own colour, not mixed toward
      // --card — that produced a strong plate in dark mode, pastel in light.
      `linear-gradient(140deg, color-mix(in srgb, ${tokens.accent} 74%, #000), ${tokens.accent})`
    : `linear-gradient(140deg, color-mix(in srgb, var(--ink) 94%, var(--primary)), color-mix(in srgb, var(--ink) 74%, var(--primary)))`;

  return (
    <div
      aria-hidden
      className={[
        "relative flex h-full w-full items-center justify-center overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background,
        // Own container so initials scale with the card, not viewport —
        // reads right from a 96px thumbnail to a full-width hero.
        containerType: "inline-size",
      }}
    >
      <span
        className="pulse-serif select-none text-[clamp(48px,18cqw,132px)] leading-none"
        style={{
          color: tokens
            ? `color-mix(in srgb, ${tokens.on} 34%, transparent)`
            : "rgb(255 255 255 / 0.16)",
        }}
      >
        {initialsOf(entityName)}
      </span>
    </div>
  );
}
