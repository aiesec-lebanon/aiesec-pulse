import { redirect } from "next/navigation";

// Pulse has no unauthenticated surface: every route is behind `requireSession()`,
// so `/` forwards to the feed, whose own guard sends a signed-out visitor to
// `/login` with a `returnTo`. A public landing page would be new product
// scope, not a routing detail — and isn't in any current phase plan.
export default function HomePage() {
  redirect("/feed");
}
