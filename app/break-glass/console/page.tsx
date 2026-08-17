import Link from "next/link";

import { breakGlassSignOut } from "@/app/actions/break-glass";
import { db } from "@/lib/db";
import { requireBreakGlass } from "@/lib/rbac/guards";

// Deliberately read-only: break-glass is for seeing what is happening when
// OAuth or GIS is down, not for moderating from a credential with no
// offboarding path.
export const metadata = {
  title: "Emergency console · AIESEC Pulse",
  robots: { index: false, follow: false },
};

function minutesRemaining(expiresAtMs: number): number {
  return Math.max(0, Math.round((expiresAtMs - Date.now()) / 60_000));
}

export default async function BreakGlassConsole() {
  const session = await requireBreakGlass();

  const [userCount, postCount, queuedCount, openDsr, recentBreakGlass, lastSync] =
    await Promise.all([
      db.user.count({ where: { status: "ACTIVE" } }),
      db.post.count({ where: { status: "PUBLISHED" } }),
      db.post.count({ where: { status: "IN_REVIEW" } }),
      db.dataSubjectRequest.count({ where: { status: { in: ["RECEIVED", "IN_PROGRESS"] } } }),
      db.auditEvent.findMany({
        where: { actorType: "BREAK_GLASS" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, action: true, actorLabel: true, createdAt: true },
      }),
      db.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    ]);

  const expiresIn = minutesRemaining(session.expiresAt);

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 py-10">
      <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--destructive)]/40 bg-[color-mix(in_srgb,var(--destructive)_8%,var(--card))] px-5 py-4">
        <p className="text-[14px] font-bold text-[var(--destructive-text)]">
          Break-glass session · {session.email} · expires in {expiresIn} minutes
        </p>
        <p className="mt-1 text-[14px] text-[var(--foreground)]">
          This session cannot be renewed. Return to the normal admin area at{" "}
          <Link href="/admin/queue" className="underline">
            /admin
          </Link>{" "}
          as soon as AIESEC sign-in is available again.
        </p>
      </div>

      <h1 className="text-[24px] font-black text-[var(--foreground)]">Platform status</h1>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Active members" value={userCount} />
        <Stat label="Published posts" value={postCount} />
        <Stat label="Awaiting review" value={queuedCount} />
        <Stat label="Open data requests" value={openDsr} />
      </div>

      <section aria-labelledby="sync-heading" className="mt-8">
        <h2 id="sync-heading" className="mb-2 text-[16px] font-bold text-[var(--foreground)]">
          Last sync run
        </h2>
        {lastSync ? (
          <p className="text-[15px] text-[var(--muted-foreground)]">
            {lastSync.kind} · {lastSync.status} · {lastSync.processed} processed, {lastSync.failed}{" "}
            failed · started {lastSync.startedAt.toISOString()}
            {lastSync.error ? ` · ${lastSync.error}` : ""}
          </p>
        ) : (
          <p className="text-[15px] text-[var(--muted-foreground)]">No sync has run yet.</p>
        )}
      </section>

      <section aria-labelledby="bg-history" className="mt-8">
        <h2 id="bg-history" className="mb-2 text-[16px] font-bold text-[var(--foreground)]">
          Recent break-glass activity
        </h2>
        {recentBreakGlass.length === 0 ? (
          <p className="text-[15px] text-[var(--muted-foreground)]">Nothing recorded.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentBreakGlass.map((event) => (
              <li key={event.id} className="aiesec-card flex flex-wrap items-center gap-3 p-3">
                <span className="text-[14px] font-medium text-[var(--foreground)]">
                  {event.action}
                </span>
                <span className="text-[14px] text-[var(--muted-foreground)]">
                  {event.actorLabel}
                </span>
                <time
                  dateTime={event.createdAt.toISOString()}
                  className="ml-auto text-[13px] tabular-nums text-[var(--muted-foreground)]"
                >
                  {event.createdAt.toISOString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={breakGlassSignOut} className="mt-10">
        <button type="submit" className="aiesec-btn-secondary">
          End break-glass session
        </button>
      </form>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="aiesec-card px-5 py-4">
      <p className="text-[28px] font-bold text-[var(--foreground)]">{value}</p>
      <p className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}
