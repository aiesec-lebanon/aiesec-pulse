"use server";

// TODO: implement createPost, deletePost, approvePost, rejectPost.
// Each must call the appropriate guard (requireMCP / requireAdmin) as its
// first line, then validate with Zod, then interact with the DB.

export async function createPost(_formData: FormData) {
  throw new Error("createPost not yet implemented");
}

export async function deletePost(_postId: string) {
  throw new Error("deletePost not yet implemented");
}

export async function approvePost(_postId: string) {
  throw new Error("approvePost not yet implemented");
}

export async function rejectPost(_postId: string, _reason: string) {
  throw new Error("rejectPost not yet implemented");
}
