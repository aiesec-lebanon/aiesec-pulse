import { PostLevel } from "@/app/generated/prisma/enums";
import { Pill } from "@/components/ui/Pill";

/** How far a post reaches, in the status-pill shape. Renders nothing for LOCAL. */
export function LevelBadge({ level, className }: { level: PostLevel; className?: string }) {
  if (level !== PostLevel.NETWORK) return null;

  return (
    <Pill
      label="Network"
      tint="color-mix(in srgb, var(--primary) 10%, transparent)"
      text="var(--primary-text)"
      className={className}
    />
  );
}
