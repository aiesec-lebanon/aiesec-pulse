import { redirect } from "next/navigation";

// Pulse has no unauthenticated surface: every route is behind `requireSession()`,
// so `/` forwards to the feed and the feed's own guard sends a signed-out
// visitor to `/login` with a `returnTo`. A public landing page would be new
// product scope, not a routing detail — it is not in any current phase plan.
export default function HomePage() {
  redirect("/feed");
}
