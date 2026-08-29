import { PostStatus } from "@/app/generated/prisma/enums";
import { Pill } from "@/components/ui/Pill";

/**
 * One shared component — PostsTable and the profile page used to keep
 * independent status-pill maps that had already drifted visually.
 */

type PillTone = { label: string; tint: string; text: string };

const TONE: Record<PostStatus, PillTone> = {
  DRAFT: { label: "Draft", tint: "var(--muted)", text: "var(--muted-foreground)" },
  IN_REVIEW: {
    label: "In review",
    tint: "color-mix(in srgb, var(--destructive) 10%, transparent)",
    text: "var(--destructive-text)",
  },
  SCHEDULED: {
    label: "Scheduled",
    tint: "color-mix(in srgb, var(--primary) 10%, transparent)",
    text: "var(--primary-text)",
  },
  PUBLISHED: {
    label: "Published",
    tint: "color-mix(in srgb, var(--success) 10%, transparent)",
    text: "var(--success-text)",
  },
  REJECTED: {
    label: "Rejected",
    tint: "color-mix(in srgb, var(--destructive) 10%, transparent)",
    text: "var(--destructive-text)",
  },
  HIDDEN: { label: "Hidden", tint: "var(--muted)", text: "var(--muted-foreground)" },
  ARCHIVED: { label: "Archived", tint: "var(--muted)", text: "var(--muted-foreground)" },
};

export function StatusPill({ status, className }: { status: PostStatus; className?: string }) {
  const tone = TONE[status];
  return <Pill label={tone.label} tint={tone.tint} text={tone.text} className={className} />;
}
