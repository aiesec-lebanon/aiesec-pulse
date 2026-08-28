import Link from "next/link";

// Public, outside the session guard: a privacy notice you can only read after
// signing in is one you cannot read before deciding whether to.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex h-16 w-full max-w-[720px] items-center justify-between px-6">
          <Link
            href="/feed"
            className="text-[18px] font-black uppercase tracking-[0.04em] text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            AIESEC Pulse
          </Link>
          <nav aria-label="Legal" className="flex gap-4 text-[14px]">
            <Link
              href="/legal/privacy"
              className="rounded-[var(--radius-sm)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Privacy
            </Link>
            <Link
              href="/legal/cookies"
              className="rounded-[var(--radius-sm)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Cookies
            </Link>
            <Link
              href="/legal/terms"
              className="rounded-[var(--radius-sm)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Terms
            </Link>
            <Link
              href="/legal/content-policy"
              className="rounded-[var(--radius-sm)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Content policy
            </Link>
          </nav>
        </div>
      </header>

      {/* --card, not --background: --muted-foreground has more contrast
          headroom there, and this page is mostly muted-foreground prose. */}
      <main id="main-content" className="mx-auto w-full max-w-[820px] flex-1 px-6 py-10">
        <article className="aiesec-card legal-prose px-6 py-8 sm:px-10 sm:py-10">
          {children}
        </article>
      </main>
    </div>
  );
}
