import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/app/admin/login/AdminLoginForm";
import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { getAdminSession } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin sign in · AIESEC Pulse" };

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin/roles");

  return (
    <main className="pulse-stage flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
      <div className="aiesec-card w-full max-w-[420px] p-8">
        <p className="pulse-label flex items-center justify-center">AIESEC Pulse</p>
        <DisplayTitle
          as="h1"
          size="sm"
          title="Platform Administration"
          className="mt-3 flex items-center justify-center text-center text-[color:var(--foreground)]"
        />

        <AdminLoginForm />

        <p className="flex mt-8 items-center justify-center text-[14px] text-[color:var(--muted-foreground)]">
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
