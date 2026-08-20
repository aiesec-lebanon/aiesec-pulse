import type { ShellUser } from "@/components/shell/ShellInteractive";

/**
 * One navigation model for the whole shell.
 *
 * Before this, the header carried three overlapping navigations: a tab strip
 * hard-coded to a single "Latest" tab with `aria-current="page"` on *every*
 * route, an account dropdown listing eight destinations, and a mobile drawer
 * listing seven of the same eight under different labels ("Your posts" vs the
 * member's name for `/profile`; "Privacy notice" → `/legal/privacy` vs
 * "Privacy & your data" → `/settings/privacy`, which are different pages).
 *
 * The fix is not to restyle three lists but to derive all of them from one:
 *
 *   - `primary`  — the reader's surfaces. The desktop rail, and the top of the
 *                  mobile drawer. This is the navigation, and it is the only
 *                  place a destination is duplicated between viewports, which
 *                  is legitimate because only one of the two is ever visible.
 *   - `authoring`/`moderation` — role-gated work surfaces. Desktop: the account
 *                  menu. Mobile: their own drawer groups.
 *   - `account`  — identity and preferences. Account menu on both.
 *
 * Every destination appears in exactly one place per viewport. Capability
 * flags decide visibility as a courtesy only — the authoritative check stays
 * in the Server Action, as it always did.
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

  if (user?.canModerate || user?.canAdminister) {
    const items: NavItem[] = [];
    if (user.canModerate) items.push({ href: "/admin/queue", label: "Moderation queue" });
    if (user.canAdminister) items.push({ href: "/admin/roles", label: "Platform administration" });
    groups.push({ id: "moderation", label: "Governance", items });
  }

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
 * Whether `item` is the destination the given pathname belongs to.
 *
 * `/feed` owns post and topic pages: a member reading a story arrived from the
 * feed and is still, as far as wayfinding goes, in it. Exact-matching `/feed`
 * alone would leave the rail with no active item on the surfaces members spend
 * the most time on.
 */
export function isCurrent(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  if (item.href !== "/" && pathname.startsWith(`${item.href}/`)) return true;
  return (item.match ?? []).some((prefix) => pathname.startsWith(prefix));
}
