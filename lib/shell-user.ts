import "server-only";

import { cache } from "react";

import type { ShellUser } from "@/components/shell/ShellInteractive";
import { getCurrentUserWithEntity } from "@/lib/auth/current-user";
import { isEnabled } from "@/lib/flags";
import { permissionsOf } from "@/lib/rbac/can";

// These flags decide what the shell shows, never what a request is allowed to
// do — that is the guard's job, at the action.
export const getShellUser = cache(async (): Promise<ShellUser | null> => {
  const user = await getCurrentUserWithEntity();
  if (!user) return null;

  const [permissions, searchEnabled] = await Promise.all([
    permissionsOf(user),
    isEnabled("search.enabled"),
  ]);

  return {
    fullName: user.fullName,
    entityName: user.primaryEntity?.name ?? null,
    canPublish: permissions.has("post.publish"),
    canModerate:
      permissions.has("post.approve") ||
      permissions.has("moderation.hide") ||
      permissions.has("moderation.report_triage"),
    searchEnabled,
  };
});
