import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Access not allowed · AIESEC Pulse" };

// Two audiences: signed in but lacking permission, or refused at sign-in
// (no recognised position). The latter has no session or feed to return
// to, so it gets its own copy with no link back into the app.
export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const refusedAtSignIn = reason === "no_position";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-6">
      {refusedAtSignIn ? (
        <EmptyState
          tone="error"
          headingLevel="h1"
          eyebrow="Access refused"
          heading="Pulse couldn't sign you in."
          body={
            <>
              <p>
                Your AIESEC account is real, but none of your current EXPA positions match a role
                Pulse recognises — so there is nothing for us to sign you in as.
              </p>
              <p className="mt-3">
                This usually means your position has ended, has not been entered in EXPA yet, or is
                recorded under a title we don&apos;t know. Ask your LC or MC&apos;s IM lead to check
                your current position in EXPA, then try again.
              </p>
            </>
          }
          action={{ href: "/login", label: "Back to sign in" }}
        />
      ) : (
        <EmptyState
          tone="error"
          headingLevel="h1"
          eyebrow="Access refused"
          heading="You don't have access to that."
          body={
            <>
              <p>
                Your AIESEC account is signed in, but it doesn&apos;t hold the permission this page
                needs — or it holds it for a different entity.
              </p>
              <p className="mt-3">
                What you can do comes from your current positions in EXPA and is re-checked every
                time you sign in. If your position changed recently, sign out and back in to refresh
                it. If it still looks wrong, ask your MC&apos;s IM lead to check the position in
                EXPA.
              </p>
            </>
          }
          action={{ href: "/feed", label: "Back to the feed" }}
          secondaryAction={{ label: "Sign out and back in", formAction: "/api/auth/logout" }}
        />
      )}
    </main>
  );
}
