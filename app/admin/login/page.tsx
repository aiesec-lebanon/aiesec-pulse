import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/auth/admin-session";
import LoginForm from "./LoginForm";

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin/queue");

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted px-6 py-12">
      <div className="aiesec-card w-full max-w-[420px] p-8">
        <h1 className="text-[28px] font-black text-foreground leading-tight mb-2">
          AIESEC Pulse — Moderator Sign In
        </h1>
        <p className="text-[14px] text-muted-foreground mb-8 leading-relaxed">
          This portal is for moderators only. Members and MCPs sign in via
          AIESEC.
        </p>

        <LoginForm />

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-[14px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to public site
          </Link>
        </div>
      </div>
    </main>
  );
}
