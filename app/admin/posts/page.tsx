import { permanentRedirect } from "next/navigation";

/**
 * Moved. This surface is held by an AIESEC position, not by the platform
 * credential, so it no longer lives under `/admin` — see
 * `app/admin/(protected)/layout.tsx` for why.
 *
 * The redirect stays because members bookmark work queues, and a 404 on a
 * bookmarked queue reads as "the feature was removed".
 */
export default function MovedPage(): never {
  permanentRedirect("/moderation/posts");
}
