import { redirect } from "next/navigation";

// Landing page: redirect authenticated users to the feed.
// TODO: once session guards are wired, redirect to /feed if logged in,
// otherwise show a public landing / sign-in prompt.
export default function HomePage() {
  redirect("/feed");
}
