import Link from "next/link";

import { CookieSettingsButton } from "@/components/legal/CookieConsent";
import { EntityName } from "@/components/ui/EntityName";

const LINK_CLASS =
  "pulse-underline inline-flex min-h-[24px] items-center rounded-[var(--radius-sm)] text-[14px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";

const POLICY_LINKS = [
  { href: "/legal/privacy", label: "Privacy notice" },
  { href: "/legal/cookies", label: "Cookie policy" },
  { href: "/legal/terms", label: "Terms of use" },
  { href: "/legal/content-policy", label: "Content policy" },
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-[var(--hairline)]">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-[color:var(--muted-foreground)]">
          An initiative by <EntityName name="AIESEC in Lebanon" />
        </p>
        <nav aria-label="Policies">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {POLICY_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={LINK_CLASS}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsButton className={LINK_CLASS} />
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
