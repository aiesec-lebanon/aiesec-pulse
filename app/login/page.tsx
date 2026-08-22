import Link from "next/link";
import { redirect } from "next/navigation";

import { MotionToggle } from "@/components/motion/MotionToggle";
import { Reveal } from "@/components/motion/Reveal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { safeReturnTo } from "@/lib/auth/oauth";
import { getActiveSession } from "@/lib/auth/session";

const ERROR_COPY: Record<string, string> = {
  missing_code: "AIESEC didn't send an authorisation code back. Please try again.",
  state_mismatch:
    "That sign-in link couldn't be verified — it may have expired, or been opened in a different browser. Please start again.",
  exchange_failed: "AIESEC couldn't complete the sign-in. Please try again in a moment.",
  not_permitted: "Your AIESEC account isn't permitted to use Pulse.",
  gis_unavailable:
    "AIESEC's member directory is unavailable right now, so we can't confirm your positions. Please try again shortly.",
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
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--stage)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 grid grid-cols-4">
        <span className="border-r border-[var(--hairline)]" />
        <span className="border-r border-[var(--hairline)]" />
        <span className="border-r border-[var(--hairline)]" />
        <span />
      </div>

      <div
        aria-hidden
        className="pulse-ambient pointer-events-none absolute -left-[10%] -top-[14%] z-0 h-[66%] w-[56%] rounded-full opacity-90"
        style={{
          background: "radial-gradient(circle at 50% 50%, var(--glow-primary), transparent 65%)",
          filter: "blur(50px)",
          animation: "aurora-orbit 30s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        className="pulse-ambient pointer-events-none absolute -right-[8%] top-[18%] z-0 h-[58%] w-[46%] rounded-full opacity-90"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--glow-destructive), transparent 65%)",
          filter: "blur(55px)",
          animation: "aurora-orbit 36s ease-in-out infinite reverse",
        }}
      />

      <div className="relative z-20 flex items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        <span className="flex select-none items-center gap-2">
          <span
            aria-hidden
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary-fill)]"
          >
            <svg viewBox="0 0 28 28" className="h-[17px] w-[17px]" fill="none" aria-hidden>
              <path
                d="M2 15h5.2l2.6-7.4 4.1 12.6 3-8.1 2 2.9H26"
                stroke="var(--primary-foreground)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-[13px] font-black uppercase leading-none tracking-[0.22em] text-[color:var(--foreground)]">
            Pulse
          </span>
        </span>

        <div className="flex items-center gap-1">
          <MotionToggle />
          <ThemeToggle />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <Reveal y={12}>
          <span aria-hidden className="mb-6 inline-flex items-center gap-1">
            <span className="h-[7px] w-[7px] bg-[var(--topic-programme)]" />
            <span className="h-[7px] w-[7px] bg-[var(--topic-function)]" />
            <span className="h-[7px] w-[7px] bg-[var(--topic-general)]" />
          </span>
        </Reveal>

        <Reveal y={20} delay={80}>
          <DisplayTitle
            as="h1"
            size="xl"
            title="Where the network reads itself"
            className="text-[color:var(--foreground)]"
          />
        </Reveal>

        <Reveal y={20} delay={200}>
          <p className="mt-6 max-w-[46ch] text-[18px] leading-[1.6] text-[color:var(--muted-foreground)]">
            Stories, announcements and updates from every entity in one place, updated as it
            happens.
          </p>
        </Reveal>

        {error && (
          <p
            role="alert"
            className="mt-6 max-w-[46ch] rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] px-4 py-3 text-[14px] leading-[1.5] text-[color:var(--destructive-text)]"
          >
            {ERROR_COPY[error] ?? "Sign-in didn't complete. Please try again."}
          </p>
        )}

        <Reveal y={20} delay={300}>
          <a
            href={startUrl}
            className="group mt-9 flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--primary-fill)] px-7 text-[14px] font-bold text-[color:var(--primary-foreground)] shadow-[var(--elev-2)] transition-[transform,box-shadow] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] hover:-translate-y-[calc(2px*var(--motion-travel))] hover:shadow-[var(--elev-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            <svg
              viewBox="0 0 28 28"
              width="16"
              height="16"
              fill="none"
              aria-hidden
              className="flex-none"
            >
              <path
                d="M2 15h5.2l2.6-7.4 4.1 12.6 3-8.1 2 2.9H26"
                stroke="var(--primary-foreground)"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Sign in with AIESEC
            <span
              aria-hidden
              className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:translate-x-[calc(4px*var(--motion-travel))]"
            >
              →
            </span>
          </a>
        </Reveal>

        <Reveal y={16} delay={380}>
          <p className="mt-6 max-w-[42ch] text-[13px] leading-[1.6] text-[color:var(--muted-foreground)]">
            See the{" "}
            <Link
              href="/legal/privacy"
              className="pulse-link rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              privacy notice
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/cookies"
              className="pulse-link rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              cookie disclosure
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </main>
  );
}
