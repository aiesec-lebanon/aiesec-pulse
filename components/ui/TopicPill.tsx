import type { TopicKind } from "@/app/generated/prisma/enums";
import { Pill } from "@/components/ui/Pill";
import { tokensForKind } from "@/lib/topics-shared";

/**
 * A topic, stated in its own colour. The one place the reader meets the colour
 * code, so it is filled rather than tinted: a solid patch teaches the code, a
 * 10% wash does not.
 *
 * The label is set in the instrument register like every other micro-label,
 * which is why this takes `Pill`'s shape rather than its default type.
 */
export function TopicPill({
  name,
  kind,
  className,
}: {
  name: string;
  kind: TopicKind;
  className?: string;
}) {
  const tokens = tokensForKind(kind);

  return (
    <Pill
      label={name}
      tint={tokens.fill}
      text={tokens.on}
      square
      // `.pulse-label` is unlayered, so it wins over Pill's own size and
      // weight utilities without an `!important` on either side.
      className={["pulse-label px-2 py-1", className].filter(Boolean).join(" ")}
    />
  );
}

/**
 * The same topic as a quiet label rather than a patch — for a card that already
 * carries a cover image, where a second solid block competes with it. Uses the
 * text-safe derivative, never the raw accent.
 */
export function TopicLabel({
  name,
  kind,
  className,
}: {
  name: string;
  kind: TopicKind;
  className?: string;
}) {
  return (
    <span
      className={["pulse-label", className].filter(Boolean).join(" ")}
      style={{ color: tokensForKind(kind).text }}
    >
      {name}
    </span>
  );
}
