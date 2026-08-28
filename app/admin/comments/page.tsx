import { permanentRedirect } from "next/navigation";

/**
 * Moved — see `app/admin/(protected)/layout.tsx`. The redirect stays because
 * members bookmark work queues, and a 404 on a bookmarked queue reads as
 * "the feature was removed".
 */
export default function MovedPage(): never {
  permanentRedirect("/moderation/comments");
}
