import Link from "next/link";

export const metadata = { title: "Access not allowed · AIESEC Pulse" };

// Two audiences share this page. Someone signed in who hit a page their
// positions do not cover, and someone whose sign-in was refused outright
// because GIS returned no position Pulse recognises. The second is not a
// permission problem they can navigate around, so it gets its own copy and no
// link back into the app.
export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const refusedAtSignIn = reason === "no_position";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-[28px] font-black leading-tight text-[color:var(--foreground)]">
        {refusedAtSignIn ? "Pulse couldn't sign you in" : "You don't have access to that"}
      </h1>

      {refusedAtSignIn ? (
        <>
          <p className="text-[16px] leading-[1.6] text-[color:var(--muted-foreground)]">
            Your AIESEC account is real, but none of your current EXPA positions match a role Pulse
            recognises — so there is nothing for us to sign you in as.
          </p>

          <p className="text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
            This usually means your position has ended, has not been entered in EXPA yet, or is
            recorded under a title we don&apos;t know. Ask your LC or MC&apos;s IM lead to check
            your current position in EXPA, then try again.
          </p>

          <Link href="/login" className="aiesec-btn-primary">
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <p className="text-[16px] leading-[1.6] text-[color:var(--muted-foreground)]">
            Your AIESEC account is signed in, but it doesn&apos;t hold the permission this page
            needs — or it holds it for a different entity.
          </p>

          <p className="text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
            What you can do comes from your current positions in EXPA and is re-checked every time
            you sign in. If your position changed recently, sign out and back in to refresh it. If
            it still looks wrong, ask your MC&apos;s IM lead to check the position in EXPA.
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
        </>
      )}
    </main>
  );
}
