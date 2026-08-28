import type { CommentStatus, EntityKind } from "@/app/generated/prisma/enums";
import { entityDisplayName } from "@/lib/org/display";

// Removed comments become tombstones, not deletions — replies stay
// anchored and the thread doesn't reshuffle under a reader.
export type CommentDto = {
  id: string;
  body: string | null;
  tombstone: boolean;
  /** Why hidden, if a moderator set one; null for self-deletion. */
  hiddenReason: string | null;
  createdAt: string;
  author: { fullName: string; entityName: string | null } | null;
};

type CommentRow = {
  id: string;
  body: string;
  status: CommentStatus;
  hiddenReason?: string | null;
  createdAt: Date;
  user: {
    fullName: string;
    primaryEntity: { name: string; kind: EntityKind } | null;
  } | null;
};

export function toCommentDto(comment: CommentRow): CommentDto {
  const tombstone = comment.status !== "VISIBLE";
  return {
    id: comment.id,
    body: tombstone ? null : comment.body,
    tombstone,
    hiddenReason: comment.status === "HIDDEN" ? (comment.hiddenReason ?? null) : null,
    createdAt: comment.createdAt.toISOString(),
    author: tombstone
      ? null
      : {
          fullName: comment.user?.fullName ?? "Former member",
          entityName: entityDisplayName(
            comment.user?.primaryEntity?.name,
            comment.user?.primaryEntity?.kind
          ),
        },
  };
}
