import { permanentRedirect } from "next/navigation";

/**
 * Moved; see app/admin/(protected)/layout.tsx. Kept as a redirect since
 * members bookmark this URL — a 404 would read as the feature vanishing.
 */
export default function MovedPage(): never {
  permanentRedirect("/moderation/posts");
}
