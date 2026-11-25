// Browser side of an image upload. The file goes straight to storage (never
// through a Vercel function body), then the server checks and stores it.

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: string };
    return new Error(body.error ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

/** Returns the URL to store in the post: the members-only media route. */
export async function uploadImage(file: File): Promise<string> {
  const signRes = await fetch("/api/storage/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  if (!signRes.ok) throw await errorFrom(signRes, "Could not start upload.");
  const { uploadUrl, uploadKey } = (await signRes.json()) as {
    uploadUrl: string;
    uploadKey: string;
  };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("Upload to storage failed. Please try again.");

  const finalizeRes = await fetch("/api/storage/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadKey }),
  });
  if (!finalizeRes.ok) throw await errorFrom(finalizeRes, "Upload failed. Please try again.");
  const { url } = (await finalizeRes.json()) as { url: string };
  return url;
}
