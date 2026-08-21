import { PostLevel } from "@/app/generated/prisma/enums";
import { Pill } from "@/components/ui/Pill";

/**
 * How far a post reaches (context.md §7.2), in §10.7a's pill shape.
 *
 * Renders nothing for LOCAL. Every post is local until an MCP promotes it, so a
 * "Local" badge would sit on almost every card saying almost nothing; the badge
 * earns its place precisely because it is rare. Promotion is also what a reader
 * needs told — this arrived from outside their own MC, or their own MC's post
 * is now in front of the whole network.
 */
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
