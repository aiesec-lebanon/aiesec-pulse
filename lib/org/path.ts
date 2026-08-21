// Two invariants make the prefix arithmetic safe: a path starts with / and
// never ends with one, and a segment never contains /. Without the second,
// /ai/mena would prefix-match /ai/menagerie and a regional grant would
// silently cover an unrelated entity.

export function pathSegment(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "entity";
}

export function joinPath(parentPath: string, segment: string): string {
  const parent = parentPath === "/" ? "" : parentPath.replace(/\/+$/, "");
  return `${parent}/${segment}`;
}

function pathParts(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export function depthOf(path: string): number {
  return pathParts(path).length;
}

/** Segment-boundary aware: `/ai/me` is not an ancestor of `/ai/mena`. */
export function isAncestorPath(ancestor: string, descendant: string): boolean {
  if (ancestor === descendant) return false;
  return descendant.startsWith(`${ancestor}/`);
}

export function isInSubtree(scopePath: string, path: string): boolean {
  return path === scopePath || isAncestorPath(scopePath, path);
}

export function ancestorPaths(path: string): string[] {
  const parts = pathParts(path);
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    out.push(`/${parts.slice(0, i).join("/")}`);
  }
  return out;
}

// Derived from the deepest shared ancestor rather than hard-coded per level,
// so it survives the tree gaining or losing a tier.
export function proximity(viewerPath: string, publisherPath: string): number {
  if (!viewerPath || !publisherPath) return 0.3;
  if (viewerPath === publisherPath) return 1.0;

  const a = pathParts(viewerPath);
  const b = pathParts(publisherPath);
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;

  switch (shared) {
    case 0:
    case 1:
      return 0.3;
    case 2:
      return 0.5;
    case 3:
      return 0.8;
    default:
      return 1.0;
  }
}
