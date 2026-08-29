/**
 * Pure, dependency-free normalise-to-hyphens core — safe to import from a
 * Client Component (e.g. a live slug preview) as well as server code.
 * Keep it that way: no `server-only`, no `db`, no I/O of any kind.
 */
export function slugBase(input: string, maxLength: number): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");
}
