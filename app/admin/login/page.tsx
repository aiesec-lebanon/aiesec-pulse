import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/app/admin/login/AdminLoginForm";
import { getAdminSession } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin sign in · AIESEC Pulse" };

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin/roles");

  return (
    <main className="pulse-stage flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
      <div className="aiesec-card w-full max-w-[420px] p-8">
        <p className="pulse-label">AIESEC Pulse</p>
        <h1 className="mt-3 text-[24px] font-black leading-tight text-[color:var(--foreground)]">
          Platform administration
        </h1>
        <p className="mt-2 text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          Configuring the platform is a separate account, not an AIESEC position. Moderators and
          publishers reach the approval queue by signing in with AIESEC.
        </p>

        <AdminLoginForm />

        <p className="mt-8 text-[14px] text-[color:var(--muted-foreground)]">
          <Link
            href="/login"
            className="pulse-link rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            Sign in with AIESEC instead
          </Link>
        </p>
      </div>
    </main>
  );
}
