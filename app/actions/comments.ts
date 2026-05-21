"use server";

// TODO: implement addComment, deleteComment.
// addComment: requireUser → validate → db.comment.create.
// deleteComment: requireAdmin → db.comment.update (soft delete) → withAudit.

export async function addComment(_postId: string, _content: string) {
  throw new Error("addComment not yet implemented");
}

export async function deleteComment(_commentId: string) {
  throw new Error("deleteComment not yet implemented");
}
