import Link from "next/link";
import { redirect } from "next/navigation";

import { safeReturnTo } from "@/lib/auth/oauth";
import { getActiveSession } from "@/lib/auth/session";

const ERROR_COPY: Record<string, string> = {
  missing_code: "AIESEC didn't send an authorisation code back. Please try again.",
  state_mismatch:
    "That sign-in link couldn't be verified — it may have expired, or been opened in a different browser. Please start again.",
  exchange_failed: "AIESEC couldn't complete the sign-in. Please try again in a moment.",
  not_permitted: "Your AIESEC account isn't permitted to use Pulse.",
  gis_unavailable:
    "AIESEC's member directory is unavailable right now and we have no recent record of your account. Please try again shortly.",
};

export const metadata = { title: "Sign in · AIESEC Pulse" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const { error, returnTo } = await searchParams;

  if (await getActiveSession()) redirect(safeReturnTo(returnTo));

  const startUrl = returnTo
    ? `/api/auth/start?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`
    : "/api/auth/start";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-6">
      <div className="aiesec-card flex w-full max-w-sm flex-col items-center gap-6 px-8 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-[22px] font-black uppercase tracking-[0.08em] text-[var(--primary-text)]">
            AIESEC Pulse
          </h1>
          <p className="text-[14px] text-[var(--muted-foreground)]">
            The global news platform for AIESEC entities worldwide.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="w-full rounded-[var(--radius-md)] border border-[var(--destructive)]/30 bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] px-4 py-3 text-[14px] leading-[1.5] text-[var(--destructive-text)]"
          >
            {ERROR_COPY[error] ?? "Sign-in didn't complete. Please try again."}
          </p>
        )}

        <a href={startUrl} className="aiesec-btn-primary w-full text-center">
          Sign in with AIESEC
        </a>

        <p className="text-center text-[12px] leading-[1.6] text-[var(--muted-foreground)]">
          Signing in creates a Pulse session and mirrors your name, entity and current positions
          from AIESEC. See the{" "}
          <Link href="/legal/privacy" className="text-[var(--primary-text)] underline">
            privacy notice
          </Link>{" "}
          and{" "}
          <Link href="/legal/cookies" className="text-[var(--primary-text)] underline">
            cookie disclosure
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
