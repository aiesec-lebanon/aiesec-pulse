import type { ShellUser } from "@/components/shell/ShellInteractive";

/**
 * One navigation model for the whole shell, derived into three views so
 * every destination appears in exactly one place per viewport: `primary`
 * (reader surfaces — desktop rail + mobile drawer top), `authoring`/
 * `governance` (role-gated work — account menu / drawer groups), and
 * `account` (identity/preferences). Capability flags only decide
 * visibility; the Server Action stays the authoritative check.
 *
 * Governance routes are AIESEC-position-gated member routes, not admin —
 * `/admin` is reserved for the credential login that actually administers
 * the platform.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Additional path prefixes that should light this item as current. */
  match?: string[];
};

export type NavGroup = {
  id: string;
  /** Group heading in the mobile drawer. Omitted for the primary group. */
  label?: string;
  items: NavItem[];
};

export type ShellNavigation = {
  primary: NavItem[];
  groups: NavGroup[];
  /** The one page-level create action, promoted out of the menus. */
  compose: NavItem | null;
};

export function buildNavigation(user: ShellUser | null): ShellNavigation {
  const primary: NavItem[] = [{ href: "/feed", label: "Feed", match: ["/posts/", "/topics/"] }];

  if (user?.searchEnabled) primary.push({ href: "/search", label: "Search" });
  if (user) primary.push({ href: "/bookmarks", label: "Bookmarks" });

  const groups: NavGroup[] = [];

  if (user?.canPublish) {
    groups.push({
      id: "authoring",
      label: "Publishing",
      items: [
        { href: "/posts/new", label: "New post" },
        { href: "/drafts", label: "Drafts", match: ["/posts/queued", "/posts/scheduled"] },
      ],
    });
  }

  const governance: NavItem[] = [];
  if (user?.canApprove) governance.push({ href: "/review", label: "Review queue" });
  if (user?.canModerateContent) {
    governance.push(
      { href: "/moderation/posts", label: "All posts" },
      { href: "/moderation/comments", label: "Comments" }
    );
  }
  if (user?.canViewInsights) governance.push({ href: "/insights", label: "Publishing activity" });
  if (governance.length > 0)
    groups.push({ id: "governance", label: "Governance", items: governance });

  if (user) {
    groups.push({
      id: "account",
      label: "Account",
      items: [
        { href: "/profile", label: "Your posts" },
        { href: "/settings/following", label: "Following" },
        { href: "/settings/privacy", label: "Privacy & your data" },
      ],
    });
  }

  return {
    primary,
    groups,
    compose: user?.canPublish ? { href: "/posts/new", label: "Write" } : null,
  };
}

/**
 * Whether `item` is the destination `pathname` belongs to. `/feed` owns
 * post/topic pages too — for wayfinding, a reader there is still "in" the
 * feed.
 */
export function isCurrent(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  if (item.href !== "/" && pathname.startsWith(`${item.href}/`)) return true;
  return (item.match ?? []).some((prefix) => pathname.startsWith(prefix));
}
