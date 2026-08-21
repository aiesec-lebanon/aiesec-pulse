import type { FollowState } from "@/app/actions/follows";
import type { PostLevel } from "@/app/generated/prisma/enums";

export type FeedPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  /** How far the post reaches (context.md §7.2). Surfaced as a badge on the card. */
  level: PostLevel;
  mediaUrl: string | null;
  mediaAlt: string | null;
  author: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    entityName: string | null;
  };
  publisherEntityId: string;
  /** The viewer's own follow state for the publishing entity — "none" when signed out. */
  entityFollowState: FollowState;
  reactionCount: number;
  commentCount: number;
  publishedAt: Date;
  topics: Array<{ slug: string; name: string }>;
};
