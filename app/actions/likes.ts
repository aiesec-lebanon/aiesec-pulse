"use server";

// TODO: implement toggleLike.
// requireUser → db.like.upsert or db.like.delete (composite PK postId+userId)
// → return updated like count.

export async function toggleLike(_postId: string): Promise<number> {
  throw new Error("toggleLike not yet implemented");
}
