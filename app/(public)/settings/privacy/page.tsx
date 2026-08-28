import Link from "next/link";

import { PrivacyControls } from "@/components/settings/PrivacyControls";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { DSR_SLA_DAYS } from "@/lib/privacy/dsr";
import { requireSession } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

export default async function PrivacySettingsPage() {
  const user = await requireSession();

  const [openRequests, sessionCount] = await Promise.all([
    db.dataSubjectRequest.findMany({
      where: { userId: user.id },
      orderBy: { receivedAt: "desc" },
      take: 10,
      select: { id: true, kind: true, status: true, receivedAt: true, dueAt: true },
    }),
    db.session.count({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pb-24">
      <PageHeader
        title="Privacy & your data"
        standfirst="What Pulse holds about you, and what you can do about it."
        breadcrumb={[{ href: "/feed", label: "Feed" }, { label: "Privacy" }]}
      />

      <p className="mt-6 text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
        The full detail is in the{" "}
        <Link
          href="/legal/privacy"
          className="pulse-link rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          privacy notice
        </Link>
        .
      </p>

      <section aria-labelledby="what-we-hold" className="mt-12">
        <h2 id="what-we-hold" className="mb-3 text-[20px] font-bold text-[color:var(--foreground)]">
          What we hold
        </h2>
        <ul className="flex flex-col gap-2 text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          <li>
            <strong className="text-[color:var(--foreground)]">Your identity</strong> — name, email,
            entity and current positions, mirrored from AIESEC&apos;s Global Information System each
            time you sign in. Pulse never edits this; EXPA is the source.
          </li>
          <li>
            <strong className="text-[color:var(--foreground)]">What you publish</strong> — posts,
            comments and reactions, kept as part of the organisational record.
          </li>
          <li>
            <strong className="text-[color:var(--foreground)]">What you read</strong> — which posts
            you opened and roughly how long for, used to report reach to publishers. This is
            personal data, it is disclosed here, and it is included in your export and erasure.
          </li>
          <li>
            <strong className="text-[color:var(--foreground)]">Your sessions</strong> —{" "}
            {sessionCount} active {sessionCount === 1 ? "session" : "sessions"} right now, each with
            a device description and a keyed hash of the network address it signed in from.
          </li>
        </ul>
      </section>

      <PrivacyControls
        openRequests={openRequests.map((r) => ({
          id: r.id,
          kind: r.kind,
          status: r.status,
          receivedAt: r.receivedAt.toISOString(),
          dueAt: r.dueAt.toISOString(),
        }))}
        slaDays={DSR_SLA_DAYS}
      />

      <section aria-labelledby="sessions-heading" className="mt-10">
        <h2
          id="sessions-heading"
          className="mb-3 text-[20px] font-bold text-[color:var(--foreground)]"
        >
          Sessions
        </h2>
        <p className="text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          Signing out everywhere revokes every session immediately — not just this browser&apos;s —
          and discards the AIESEC tokens Pulse holds for you.
        </p>
        <form action="/api/auth/logout?everywhere=1" method="post" className="mt-3">
          <button type="submit" className="aiesec-btn-secondary">
            Sign out everywhere
          </button>
        </form>
      </section>
    </main>
  );
}
