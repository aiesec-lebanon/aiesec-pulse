import { redirect } from "next/navigation";

// No unauthenticated surface: every route sits behind requireSession(), so
// `/` just forwards to the feed (whose guard sends signed-out visitors to
// `/login`). A public landing page would be new product scope, not routing.
export default function HomePage() {
  redirect("/feed");
}
