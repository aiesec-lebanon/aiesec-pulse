// Dependency-free so client and server code can both build media links.

/**
 * Route that checks the member session, then redirects to a short-lived signed
 * link. next/image must render these `unoptimized`: its optimiser fetches the
 * source without the member's cookie and would get a 401.
 */
export const MEDIA_ROUTE = "/api/media";

export function mediaRouteUrl(bucket: string, key: string): string {
  return `${MEDIA_ROUTE}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * The object key inside `bucket` for a stored path. Rows from before the
 * private bucket may hold a full public URL; the key is read out of it.
 * Returns null for a URL that points somewhere else entirely.
 */
export function mediaKey(bucket: string, path: string): string | null {
  if (!/^https?:\/\//.test(path)) return path;
  const marker = `/${bucket}/`;
  const at = path.indexOf(marker);
  if (at === -1) return null;
  const key = path.slice(at + marker.length).split(/[?#]/)[0];
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}
