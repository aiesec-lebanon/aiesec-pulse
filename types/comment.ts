export type CommentDto = {
  id: string;
  content: string | null;
  tombstone: boolean;
  createdAt: string;
  author: { fullName: string; committeeName: string | null } | null;
};

export function toCommentDto(c: {
  id: string;
  content: string;
  deletedAt: Date | null;
  createdAt: Date;
  user: { fullName: string; committeeName: string | null } | null;
}): CommentDto {
  const tombstone = c.deletedAt !== null;
  return {
    id: c.id,
    content: tombstone ? null : c.content,
    tombstone,
    createdAt: c.createdAt.toISOString(),
    author: tombstone
      ? null
      : {
          fullName: c.user!.fullName,
          committeeName: c.user?.committeeName ?? null,
        },
  };
}
