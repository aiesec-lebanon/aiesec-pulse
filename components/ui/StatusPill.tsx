import { PostStatus } from "@/app/generated/prisma/enums";

/**
 * Status pill (§10.7a), as one component instead of two maps.
 *
 * `PostsTable`'s `STATUS_PILL` and the profile page's `STATUS_BADGE` were
 * independent copies that had already drifted — the profile map added borders
 * and mixed its tints into `--card` rather than `transparent`, so the same
 * post status rendered differently depending on which page you were on. §10.7a
 * describes one shape; this is it, and both call sites now use it.
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
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-[var(--radius-md)] px-2 py-0.5 text-[12px] font-medium",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ background: tone.tint, color: tone.text }}
    >
      {tone.label}
    </span>
  );
}

export function statusLabel(status: PostStatus): string {
  return TONE[status].label;
}
