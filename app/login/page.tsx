import Link from "next/link";
import { redirect } from "next/navigation";

import { MotionToggle } from "@/components/motion/MotionToggle";
import { NetworkField } from "@/components/motion/NetworkField";
import { Tilt } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { ThemeToggle } from "@/components/ThemeToggle";
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
    <main className="pulse-stage relative flex min-h-screen flex-col overflow-hidden">
      {/* The network, drawn: a projected point cloud of connected nodes. It is
          the product's own mechanism as an image, and the reason this screen
          does not need a stock illustration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 aspect-square w-[min(160vw,1100px)] -translate-x-1/2 -translate-y-1/2 opacity-90 lg:left-[26%] lg:w-[min(90vw,880px)]"
      >
        <NetworkField density={280} intensity={1} />
      </div>

      <div className="absolute right-4 top-4 z-20 flex items-center gap-1 sm:right-6 sm:top-6">
        <MotionToggle />
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1240px] flex-1 grid-cols-1 items-center gap-16 px-6 py-20 lg:grid-cols-[1.05fr_minmax(380px,420px)] lg:gap-12">
        <div className="max-w-[34ch] lg:max-w-none">
          <Reveal y={0}>
            <span
              aria-hidden
              className="mb-8 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-fill)] shadow-[var(--elev-3)]"
            >
              <svg viewBox="0 0 28 28" className="h-full w-full" fill="none" aria-hidden>
                <path
                  d="M2 15h5.2l2.6-7.4 4.1 12.6 3-8.1 2 2.9H26"
                  stroke="var(--primary-foreground)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </Reveal>

          {/* Per-line mask: each line rises out of its own box in sequence,
              which is the one authored moment this screen gets. */}
          <h1 className="pulse-display pulse-display-xl text-[color:var(--foreground)]">
            {["AIESEC", "Pulse"].map((line, i) => (
              <Reveal key={line} y={0} delay={80 + i * 110} className="pulse-line-mask">
                <span>{line}</span>
              </Reveal>
            ))}
          </h1>

          <Reveal y={20} delay={340}>
            <p className="mt-7 max-w-[42ch] text-[18px] leading-[1.6] text-[color:var(--muted-foreground)]">
              What is happening across the network, in one place — scoped to your entity, your
              region and the functions you work in, rather than one flat global feed.
            </p>
          </Reveal>

          <Reveal y={20} delay={430}>
            <p className="pulse-label mt-10">AI · Regions · Member Committees · Local Committees</p>
          </Reveal>
        </div>

        <Reveal y={32} scale={0.97} delay={200}>
          <Tilt max={5} lift={16}>
            <div className="pulse-plate relative overflow-hidden p-8 shadow-[var(--elev-4)] sm:p-10">
              <div
                className="pulse-tilt-layer"
                style={{ "--layer-z": "28px" } as React.CSSProperties}
              >
                <h2 className="text-[20px] font-bold leading-tight text-[color:var(--foreground)]">
                  Sign in
                </h2>
                <p className="mt-2 text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
                  Pulse uses your AIESEC account. There is no separate password.
                </p>

                {error && (
                  <p
                    role="alert"
                    className="mt-6 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] px-4 py-3 text-[14px] leading-[1.5] text-[color:var(--destructive-text)]"
                  >
                    {ERROR_COPY[error] ?? "Sign-in didn't complete. Please try again."}
                  </p>
                )}

                <a
                  href={startUrl}
                  className="group mt-7 flex min-h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--primary-fill)] px-6 text-[16px] font-bold text-[color:var(--primary-foreground)] shadow-[var(--elev-2)] transition-[transform,box-shadow] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] hover:-translate-y-[calc(2px*var(--motion-travel))] hover:shadow-[var(--elev-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                >
                  Sign in with AIESEC
                  <span
                    aria-hidden
                    className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover:translate-x-[calc(4px*var(--motion-travel))]"
                  >
                    →
                  </span>
                </a>

                <p className="mt-6 text-[13px] leading-[1.6] text-[color:var(--muted-foreground)]">
                  Signing in creates a Pulse session and mirrors your name, entity and current
                  positions from AIESEC. See the{" "}
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
              </div>
            </div>
          </Tilt>
        </Reveal>
      </div>
    </main>
  );
}
