import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { type Principal, scopePathsFor } from "@/lib/rbac/can";
import type { PermissionKey } from "@/lib/rbac/catalogue";

// IMPOSSIBLE rather than an empty filter when the permission is held nowhere:
// an empty filter would return everything, which is the failure this type
// exists to make unrepresentable.

export const IMPOSSIBLE: Prisma.PostWhereInput = { id: { in: [] } };

export type ScopeFilter =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "subtrees"; paths: string[] };

export async function resolveScopeFilter(
  user: Principal,
  permission: PermissionKey
): Promise<ScopeFilter> {
  const paths = await scopePathsFor(user, permission);
  if (paths.length === 0) return { kind: "none" };
  if (paths.includes(null)) return { kind: "all" };
  return { kind: "subtrees", paths: paths.filter((p): p is string => p !== null) };
}

/** Prisma `where` fragment restricting posts by their publisher entity. */
export function postScopeWhere(filter: ScopeFilter): Prisma.PostWhereInput {
  switch (filter.kind) {
    case "all":
      return {};
    case "none":
      return IMPOSSIBLE;
    case "subtrees":
      return {
        OR: filter.paths.flatMap<Prisma.PostWhereInput>((path) => [
          { publisher: { path } },
          { publisher: { path: { startsWith: `${path}/` } } },
        ]),
      };
  }
}

/** The same restriction expressed against a comment's parent post. */
export function commentScopeWhere(filter: ScopeFilter): Prisma.CommentWhereInput {
  switch (filter.kind) {
    case "all":
      return {};
    case "none":
      return { id: { in: [] } };
    case "subtrees":
      return {
        OR: filter.paths.flatMap<Prisma.CommentWhereInput>((path) => [
          { post: { publisher: { path } } },
          { post: { publisher: { path: { startsWith: `${path}/` } } } },
        ]),
      };
  }
}

/** The same restriction expressed against `AuditEvent.entityId`. */
export function auditScopeWhere(
  filter: ScopeFilter,
  entityIdsInScope: string[]
): Prisma.AuditEventWhereInput {
  switch (filter.kind) {
    case "all":
      return {};
    case "none":
      return { id: { in: [] } };
    case "subtrees":
      return { entityId: { in: entityIdsInScope } };
  }
}
