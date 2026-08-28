import type { TopicKind } from "@/app/generated/prisma/enums";
import { Pill } from "@/components/ui/Pill";
import { tokensForKind } from "@/lib/topics-shared";

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

/** Uses the text-safe derivative, never the raw accent. */
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
