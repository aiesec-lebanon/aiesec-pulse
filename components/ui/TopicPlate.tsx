import type { TopicKind } from "@/app/generated/prisma/enums";
import { initialsOf, tokensForKind } from "@/lib/topics-shared";

/**
 * What a post shows when it has no cover art, which is most posts: a field of
 * the topic's colour carrying the publishing entity's initials, set very large
 * and very pale in the display serif.
 *
 * It replaces the grey placeholder graphic. A placeholder says "an image is
 * missing"; a plate says "AIESEC in Brazil published this, about a programme",
 * which is information the card wanted anyway. The initials are decorative —
 * the entity's full name is on the card already — so they are hidden from
 * assistive technology rather than read out as two stray letters.
 *
 * **`kind` may be null, and then the plate is neutral.** Defaulting an untagged
 * post to `GENERAL` painted it in full orange and told the reader it was filed
 * under something the network decided together — a claim the post does not
 * make. A deep brand-tinted ink field says only "no cover", which is the truth.
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
    ? // Deep corner to bright corner in the topic's own colour, rather than a
      // wash toward the surface: mixing into `--card` produced a strong plate on
      // the dark ground and a pastel one on the light ground, so the same post
      // looked like two different topics across themes.
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
        // The plate is its own container, so the initials scale with the card
        // they sit in rather than with the viewport — the same component reads
        // right in a 96px sidebar thumbnail and a full-width hero.
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
