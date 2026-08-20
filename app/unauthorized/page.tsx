import Link from "next/link";

export const metadata = { title: "Access not allowed · AIESEC Pulse" };

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-[28px] font-black leading-tight text-[color:var(--foreground)]">
        You don&apos;t have access to that
      </h1>

      <p className="text-[16px] leading-[1.6] text-[color:var(--muted-foreground)]">
        Your AIESEC account is signed in, but it doesn&apos;t hold the permission this page needs —
        or it holds it for a different entity.
      </p>

      <p className="text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
        Publishing and moderation rights come from your current positions in EXPA and are re-checked
        every time you sign in. If your position changed recently, sign out and back in to refresh
        them. If it still looks wrong, ask your MC&apos;s IM lead — they can see and grant platform
        roles.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/feed" className="aiesec-btn-primary">
          Back to the feed
        </Link>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="aiesec-btn-secondary">
            Sign out and back in
          </button>
        </form>
      </div>
    </main>
  );
}
