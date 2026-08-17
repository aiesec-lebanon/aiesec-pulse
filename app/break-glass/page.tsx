import { redirect } from "next/navigation";

import { BreakGlassForm } from "@/components/break-glass/BreakGlassForm";
import { getBreakGlassSession } from "@/lib/auth/break-glass";

// Linked from nowhere and noindex: this door is found by people who were
// told where it is.
export const metadata = {
  title: "Emergency access · AIESEC Pulse",
  robots: { index: false, follow: false },
};

export default async function BreakGlassPage() {
  if (await getBreakGlassSession()) redirect("/break-glass/console");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--destructive)]/40 bg-[color-mix(in_srgb,var(--destructive)_8%,var(--card))] px-5 py-4">
          <h1 className="text-[18px] font-black text-[var(--destructive-text)]">
            Emergency access
          </h1>
          <p className="mt-2 text-[14px] leading-[1.6] text-[var(--foreground)]">
            This is not the normal way in. Platform admins sign in with AIESEC at{" "}
            <span className="font-medium">/login</span>.
          </p>
          <p className="mt-2 text-[14px] leading-[1.6] text-[var(--foreground)]">
            Every attempt here — successful or not — raises a CRITICAL alert to the platform team
            and is written to the audit log. Sessions last 60 minutes and cannot be extended.
          </p>
        </div>

        <BreakGlassForm />
      </div>
    </main>
  );
}
